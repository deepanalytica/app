package com.photorecovery

import android.app.Application
import android.content.ContentUris
import android.content.IntentSender
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class RecoveryViewModel(application: Application) : AndroidViewModel(application) {

    private val _items = MutableLiveData<List<PhotoItem>>(emptyList())
    val items: LiveData<List<PhotoItem>> = _items

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _statusMessage = MutableLiveData("Presiona Escanear para buscar en WhatsApp, Telegram y todos los rincones del teléfono")
    val statusMessage: LiveData<String> = _statusMessage

    private val _pendingIntentSender = MutableLiveData<IntentSender?>()
    val pendingIntentSender: LiveData<IntentSender?> = _pendingIntentSender

    private var pendingCount = 0

    private val imageExts = setOf("jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif")
    private val videoExts = setOf("mp4", "mov", "avi", "mkv", "3gp", "wmv", "m4v", "ts")

    // Todas las rutas a escanear: ruta relativa -> etiqueta visible
    private val scanLocations = linkedMapOf(
        // Papeleras
        "MIUI/Gallery/cloud/trash" to "🗑 Papelera MIUI",
        "MIUI/Gallery/trash" to "🗑 Papelera MIUI",
        ".gallery_trash" to "🗑 Papelera",
        // WhatsApp (ruta antigua, Android <11)
        "WhatsApp/Media/WhatsApp Images" to "WhatsApp",
        "WhatsApp/Media/WhatsApp Images/Sent" to "WhatsApp Enviadas",
        "WhatsApp/Media/WhatsApp Video" to "WhatsApp Video",
        "WhatsApp/Media/WhatsApp Video/Sent" to "WhatsApp Video Env.",
        "WhatsApp/Media/WhatsApp Animated Gifs" to "WhatsApp GIFs",
        "WhatsApp/Media/WhatsApp Documents" to "WhatsApp Docs",
        // WhatsApp (ruta nueva, Android 11+)
        "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images" to "WhatsApp",
        "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/Sent" to "WhatsApp Enviadas",
        "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video" to "WhatsApp Video",
        "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video/Sent" to "WhatsApp Video Env.",
        "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Animated Gifs" to "WhatsApp GIFs",
        // WhatsApp Business
        "WhatsApp Business/Media/WhatsApp Business Images" to "WA Business",
        "Android/media/com.whatsapp.w4b/WhatsApp Business/Media/WhatsApp Business Images" to "WA Business",
        // Telegram
        "Telegram" to "Telegram",
        "Telegram/Telegram Images" to "Telegram",
        "Telegram/Telegram Video" to "Telegram Video",
        "Telegram/Telegram Documents" to "Telegram Docs",
        // Telegram X
        "Android/data/org.thunderdog.challegram/files/documents" to "Telegram X",
        // Descargas
        "Download" to "Descargas",
        "Downloads" to "Descargas",
        // Capturas de pantalla
        "MIUI/Screenshots" to "Capturas",
        "Pictures/Screenshots" to "Capturas",
        "DCIM/Screenshots" to "Capturas",
        // Instagram
        "Pictures/Instagram" to "Instagram",
        "DCIM/Instagram" to "Instagram",
        // Facebook
        "DCIM/Facebook" to "Facebook",
        "DCIM/Facebook Reels" to "Facebook",
        "Pictures/Facebook" to "Facebook",
        // Signal
        "Pictures/Signal" to "Signal",
        // Snapchat
        "Android/data/com.snapchat.android/files/" to "Snapchat",
        // TikTok
        "DCIM/TikTok" to "TikTok",
        // Miniaturas (baja calidad, util si el original fue borrado)
        "DCIM/.thumbnails" to "🖼 Miniatura",
        "Pictures/.thumbnails" to "🖼 Miniatura",
        // Camara
        "DCIM/Camera" to "Cámara",
        "DCIM/Camera1" to "Cámara",
    )

    fun scanEverything(hasManageStorage: Boolean) {
        viewModelScope.launch {
            _isLoading.value = true
            _statusMessage.value = "Escaneando WhatsApp, Telegram, papeleras y mas..."

            val found = withContext(Dispatchers.IO) {
                val result = mutableListOf<PhotoItem>()

                // 1. Papelera estandar Android 11+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    result += queryMediaStoreTrash(
                        MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL), false
                    )
                    result += queryMediaStoreTrash(
                        MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL), true
                    )
                }

                // 2. Escaneo de todas las carpetas del sistema de archivos
                if (hasManageStorage) {
                    result += scanFolders()
                }

                // Deduplicar por ruta de archivo, ordenar por fecha desc
                result
                    .distinctBy { it.filePath ?: "${it.id}" }
                    .sortedByDescending { it.dateModified }
            }

            _items.value = found
            _isLoading.value = false

            if (found.isEmpty()) {
                _statusMessage.value = if (!hasManageStorage)
                    "Concede el permiso naranja para escanear WhatsApp y mas"
                else
                    "No se encontraron archivos en ninguna ubicacion"
            } else {
                // Resumen por fuente
                val bySource = found.groupBy { it.sourceName }
                val summary = bySource.entries
                    .sortedByDescending { it.value.size }
                    .take(4)
                    .joinToString(" | ") { "${it.key}: ${it.value.size}" }
                _statusMessage.value = "${found.size} archivos encontrados — $summary"
            }
        }
    }

    private fun queryMediaStoreTrash(collection: Uri, isVideo: Boolean): List<PhotoItem> {
        val context = getApplication<Application>()
        val projection = arrayOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.DATE_MODIFIED,
            MediaStore.MediaColumns.SIZE
        )
        val queryArgs = Bundle().apply {
            putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_ONLY)
        }
        val result = mutableListOf<PhotoItem>()
        context.contentResolver.query(collection, projection, queryArgs, null)?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_MODIFIED)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
            while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                result.add(PhotoItem(
                    id = id,
                    uri = ContentUris.withAppendedId(collection, id),
                    displayName = cursor.getString(nameCol) ?: "archivo",
                    dateModified = cursor.getLong(dateCol),
                    size = cursor.getLong(sizeCol),
                    isVideo = isVideo,
                    sourceName = "🗑 Papelera Android"
                ))
            }
        }
        return result
    }

    private fun scanFolders(): List<PhotoItem> {
        val sdcard = Environment.getExternalStorageDirectory()
        val result = mutableListOf<PhotoItem>()
        for ((relativePath, label) in scanLocations) {
            val dir = File(sdcard, relativePath)
            if (!dir.exists() || !dir.isDirectory) continue
            dir.listFiles()?.forEach { file ->
                if (!file.isFile) return@forEach
                if (file.name.startsWith(".") && file.extension.isEmpty()) return@forEach
                val ext = file.extension.lowercase()
                val isImg = ext in imageExts
                val isVid = ext in videoExts
                if (!isImg && !isVid) return@forEach
                result.add(PhotoItem(
                    id = 0L,
                    uri = Uri.fromFile(file),
                    displayName = file.name,
                    dateModified = file.lastModified() / 1000,
                    size = file.length(),
                    isVideo = isVid,
                    isFromMiuiTrash = relativePath.contains("trash"),
                    filePath = file.absolutePath,
                    sourceName = label
                ))
            }
        }
        return result
    }

    fun recoverSelected(selected: List<PhotoItem>) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val fileItems = selected.filter { it.filePath != null }
                val storeItems = selected.filter { it.filePath == null }

                var copied = 0
                if (fileItems.isNotEmpty()) {
                    copied = withContext(Dispatchers.IO) { copyToRecovered(fileItems) }
                }

                if (storeItems.isNotEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    pendingCount = storeItems.size + copied
                    val pi = MediaStore.createTrashRequest(
                        getApplication<Application>().contentResolver,
                        storeItems.map { it.uri },
                        false
                    )
                    _pendingIntentSender.value = pi.intentSender
                } else {
                    _isLoading.value = false
                    _statusMessage.value = if (copied > 0)
                        "$copied archivo(s) guardado(s) en DCIM/Recuperadas ✓"
                    else "No se pudo recuperar nada"
                    if (copied > 0) scanEverything(true)
                }
            } catch (e: Exception) {
                _statusMessage.value = "Error: ${e.message}"
                _isLoading.value = false
            }
        }
    }

    private fun copyToRecovered(items: List<PhotoItem>): Int {
        val context = getApplication<Application>()
        val destDir = File(Environment.getExternalStorageDirectory(), "DCIM/Recuperadas").also { it.mkdirs() }
        var count = 0
        for (item in items) {
            val src = File(item.filePath ?: continue)
            if (!src.exists()) continue
            try {
                val dst = File(destDir, src.name)
                src.copyTo(dst, overwrite = true)
                MediaScannerConnection.scanFile(context, arrayOf(dst.absolutePath), null, null)
                count++
            } catch (_: Exception) {}
        }
        return count
    }

    fun onRecoveryResult(success: Boolean) {
        _isLoading.value = false
        _pendingIntentSender.value = null
        val hasManage = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                Environment.isExternalStorageManager()
        if (success) {
            _statusMessage.value = "$pendingCount archivo(s) recuperado(s) ✓"
            scanEverything(hasManage)
        } else {
            _statusMessage.value = "Recuperación cancelada"
        }
    }
}
