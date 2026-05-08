package com.photorecovery

data class EventItem(
    val timestamp: Long,
    val title: String,
    val detail: String,
    val category: String   // "app", "sent", "photo", "screenshot", "screen"
)
