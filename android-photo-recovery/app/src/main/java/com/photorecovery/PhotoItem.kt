package com.photorecovery

import android.net.Uri

data class PhotoItem(
    val id: Long,
    val uri: Uri,
    val displayName: String,
    val dateModified: Long,
    val size: Long,
    var isSelected: Boolean = false
)
