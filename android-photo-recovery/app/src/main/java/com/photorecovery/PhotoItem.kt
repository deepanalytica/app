package com.photorecovery

import android.net.Uri

data class PhotoItem(
    val id: Long,
    val uri: Uri,
    val displayName: String,
    val dateModified: Long,
    val size: Long,
    val isVideo: Boolean = false,
    val isFromMiuiTrash: Boolean = false,
    val filePath: String? = null,
    var isSelected: Boolean = false
)
