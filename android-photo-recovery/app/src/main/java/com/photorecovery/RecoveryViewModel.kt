package com.photorecovery

import android.app.Application
import android.content.ContentUris
import android.content.IntentSender
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

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

    fun scanDeletedMedia() {
        viewModelScope.launch {
            _isLoading.value = true
            _statusMessage.value = "Escaneando papelera de reciclaje (fotos y videos)..."
            val found = withContext(Dispatchers.IO) { queryAllTrashedMedia() }
            _items.value = found
            _isLoading.value = false
            _statusMessage.value = when {
                found.isEmpty() -> "No se encontraron archivos en la papelera\n" +
                        "(En MIUI: abre Galeria > Álbumes > Eliminados recientemente)"
                else -> {
                    val photos = found.count { !it.isVideo }
                    val videos = found.count { it.isVideo }
                    "${found.size} archivo(s): $photos foto(s), $videos video(s) — mantén pulsado para seleccionar"
                }
            }
        }
    }

    private fun queryAllTrashedMedia(): List<PhotoItem> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return emptyList()
        val result = mutableListOf<PhotoItem>()
        result += queryCollection(
            MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL),
            isVideo = false
        )
        result += queryCollection(
            MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL),
            isVideo = true
        )
        return result.sortedByDescending { it.dateModified }
    }

    private fun queryCollection(collection: Uri, isVideo: Boolean): List<PhotoItem> {
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

    fun recoverSelected(photos: List<PhotoItem>) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        viewModelScope.launch {
            _isLoading.value = true
            try {
                val context = getApplication<Application>()
                pendingCount = photos.size
                val pi = MediaStore.createTrashRequest(
                    context.contentResolver,
                    photos.map { it.uri },
                    false
                )
                _pendingIntentSender.value = pi.intentSender
            } catch (e: Exception) {
                _statusMessage.value = "Error al recuperar: ${e.message}"
                _isLoading.value = false
            }
        }
    }

    fun onRecoveryResult(success: Boolean) {
        _isLoading.value = false
        _pendingIntentSender.value = null
        if (success) {
            _statusMessage.value = "$pendingCount archivo(s) recuperado(s) exitosamente ✓"
            scanDeletedMedia()
        } else {
            _statusMessage.value = "Recuperación cancelada"
        }
    }
}
