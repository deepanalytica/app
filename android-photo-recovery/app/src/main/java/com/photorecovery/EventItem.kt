package com.photorecovery

data class EventItem(
    val timestamp: Long,
    val title: String,
    val detail: String,
    val category: String,
    val durationMs: Long = 0L
)
