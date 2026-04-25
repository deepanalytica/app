package com.photorecovery

import android.app.Application
import android.content.ContentUris
import android.content.IntentSender
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

    private val _photos = MutableLiveData<List<PhotoItem>>(emptyList())
    val photos: LiveData<List<PhotoItem>> = _photos

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _statusMessage = MutableLiveData("Presiona \"Escanear\" para buscar fotos eliminadas")
    val statusMessage: LiveData<String> = _statusMessage

    private val _pendingIntentSender = MutableLiveData<IntentSender?>()
    val pendingIntentSender: LiveData<IntentSender?> = _pendingIntentSender

    private var pendingCount = 0

    fun scanDeletedPhotos() {
        viewModelScope.launch {
            _isLoading.value = true
            _statusMessage.value = "Escaneando papelera de reciclaje..."
            val found = withContext(Dispatchers.IO) { queryTrashedPhotos() }
            _photos.value = found
            _isLoading.value = false
            _statusMessage.value = if (found.isEmpty())
                "No se encontraron fotos en la papelera"
            else
                "${found.size} foto(s) encontrada(s) — mantén pulsado para seleccionar"
        }
    }

    private fun queryTrashedPhotos(): List<PhotoItem> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return emptyList()
        val context = getApplication<Application>()
        val collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.DATE_MODIFIED,
            MediaStore.Images.Media.SIZE
        )
        val queryArgs = Bundle().apply {
            putInt(MediaStore.QUERY_ARG_MATCH_TRASHED, MediaStore.MATCH_ONLY)
        }
        val result = mutableListOf<PhotoItem>()
        context.contentResolver.query(collection, projection, queryArgs, null)?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_MODIFIED)
            val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE)
            while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                result.add(
                    PhotoItem(
                        id = id,
                        uri = ContentUris.withAppendedId(collection, id),
                        displayName = cursor.getString(nameCol) ?: "sin_nombre.jpg",
                        dateModified = cursor.getLong(dateCol),
                        size = cursor.getLong(sizeCol)
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
                    false // false = untrash / recover
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
            _statusMessage.value = "$pendingCount foto(s) recuperada(s) exitosamente ✓"
            scanDeletedPhotos()
        } else {
            _statusMessage.value = "Recuperación cancelada"
        }
    }
}
