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

    private val _statusMessage = MutableLiveData("Presiona \"Escanear\" para buscar fotos y videos eliminados")
    val statusMessage: LiveData<String> = _statusMessage

    private val _pendingIntentSender = MutableLiveData<IntentSender?>()
    val pendingIntentSender: LiveData<IntentSender?> = _pendingIntentSender

    private var pendingCount = 0

    // Rutas conocidas de la papelera de MIUI
    private val miuiTrashPaths = listOf(
        "MIUI/Gallery/cloud/trash",
        "MIUI/Gallery/trash",
        ".gallery_trash"
    )

    private val imageExtensions = setOf("jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif")
    private val videoExtensions = setOf("mp4", "mov", "avi", "mkv", "3gp", "wmv", "m4v")

    fun scanDeletedMedia(hasManageStorage: Boolean) {
        viewModelScope.launch {
            _isLoading.value = true
            _statusMessage.value = "Escaneando papelera..."
            val found = withContext(Dispatchers.IO) {
                val result = mutableListOf<PhotoItem>()

                // 1. Papelera estandar Android 11+ (MediaStore IS_TRASHED)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    result += queryMediaStoreTrash(
                        MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL), false
                    )
                    result += queryMediaStoreTrash(
                        MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL), true
                    )
                }

                // 2. Papelera propia de MIUI (requiere MANAGE_EXTERNAL_STORAGE)
                if (hasManageStorage && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                    Environment.isExternalStorageManager()
                ) {
                    result += scanMiuiTrashFolders()
                }

                // Eliminar duplicados por nombre+tamaño y ordenar por fecha
                result
                    .distinctBy { it.displayName + it.size }
                    .sortedByDescending { it.dateModified }
            }

            _items.value = found
            _isLoading.value = false
            _statusMessage.value = when {
                found.isEmpty() ->
                    if (!hasManageStorage)
                        "Papelera Android vacia.\nConcede permiso \"Todos los archivos\" para buscar en la papelera de MIUI Gallery"
                    else
                        "No se encontraron fotos/videos en la papelera"
                else -> {
                    val photos = found.count { !it.isVideo }
                    val videos = found.count { it.isVideo }
                    val miui = found.count { it.isFromMiuiTrash }
                    "${found.size} archivo(s): $photos foto(s) | $videos video(s)" +
                            if (miui > 0) " ($miui de MIUI)" else ""
                }
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
                result.add(
                    PhotoItem(
                        id = id,
                        uri = ContentUris.withAppendedId(collection, id),
                        displayName = cursor.getString(nameCol) ?: "archivo",
                        dateModified = cursor.getLong(dateCol),
                        size = cursor.getLong(sizeCol),
                        isVideo = isVideo
                    )
                )
            }
        }
        return result
    }

    private fun scanMiuiTrashFolders(): List<PhotoItem> {
        val sdcard = Environment.getExternalStorageDirectory()
        val result = mutableListOf<PhotoItem>()
        for (relativePath in miuiTrashPaths) {
            val dir = File(sdcard, relativePath)
            if (!dir.exists() || !dir.isDirectory) continue
            dir.walkTopDown()
                .filter { it.isFile }
                .forEach { file ->
                    val ext = file.extension.lowercase()
                    val isImage = ext in imageExtensions
                    val isVideo = ext in videoExtensions
                    if (!isImage && !isVideo) return@forEach
                    result.add(
                        PhotoItem(
                            id = 0L,
                            uri = Uri.fromFile(file),
                            displayName = file.name,
                            dateModified = file.lastModified() / 1000,
                            size = file.length(),
                            isVideo = isVideo,
                            isFromMiuiTrash = true,
                            filePath = file.absolutePath
                        )
                    )
                }
        }
        return result
    }

    fun recoverSelected(selected: List<PhotoItem>) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val miuiItems = selected.filter { it.isFromMiuiTrash }
                val standardItems = selected.filter { !it.isFromMiuiTrash }

                // Recuperar archivos MIUI copiandolos a DCIM/Recuperadas
                var miuiRecovered = 0
                if (miuiItems.isNotEmpty()) {
                    miuiRecovered = withContext(Dispatchers.IO) { recoverMiuiFiles(miuiItems) }
                }

                if (standardItems.isNotEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    // Recuperar via MediaStore (muestra dialogo del sistema)
                    val context = getApplication<Application>()
                    pendingCount = standardItems.size + miuiRecovered
                    val pi = MediaStore.createTrashRequest(
                        context.contentResolver,
                        standardItems.map { it.uri },
                        false
                    )
                    _pendingIntentSender.value = pi.intentSender
                } else {
                    _isLoading.value = false
                    if (miuiRecovered > 0) {
                        _statusMessage.value =
                            "$miuiRecovered archivo(s) copiado(s) a DCIM/Recuperadas ✓"
                        scanDeletedMedia(true)
                    } else {
                        _statusMessage.value = "No se pudo recuperar ninguno"
                    }
                }
            } catch (e: Exception) {
                _statusMessage.value = "Error: ${e.message}"
                _isLoading.value = false
            }
        }
    }

    private fun recoverMiuiFiles(photos: List<PhotoItem>): Int {
        val context = getApplication<Application>()
        val recoveryDir = File(
            Environment.getExternalStorageDirectory(), "DCIM/Recuperadas"
        ).also { it.mkdirs() }
        var count = 0
        for (photo in photos) {
            val src = File(photo.filePath ?: continue)
            if (!src.exists()) continue
            try {
                val dst = File(recoveryDir, photo.displayName)
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
        if (success) {
            _statusMessage.value = "$pendingCount archivo(s) recuperado(s) ✓"
            scanDeletedMedia(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                    Environment.isExternalStorageManager())
        } else {
            _statusMessage.value = "Recuperación cancelada"
        }
    }
}
