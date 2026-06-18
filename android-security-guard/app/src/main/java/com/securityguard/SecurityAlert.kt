package com.securityguard

data class SecurityAlert(
    val id: String = System.currentTimeMillis().toString(),
    val title: String,
    val detail: String,
    val severity: Severity,
    val category: Category,
    val timestamp: Long = System.currentTimeMillis(),
    val packageName: String? = null
)

enum class Severity { INFO, LOW, MEDIUM, HIGH, CRITICAL }
enum class Category  { MIC, CAMERA, CALL, SYSTEM, APP, NETWORK }

fun Severity.color(): Int = when (this) {
    Severity.INFO     -> 0xFF2196F3.toInt()
    Severity.LOW      -> 0xFF4CAF50.toInt()
    Severity.MEDIUM   -> 0xFFFF9800.toInt()
    Severity.HIGH     -> 0xFFF44336.toInt()
    Severity.CRITICAL -> 0xFF9C27B0.toInt()
}

fun Category.icon(): String = when (this) {
    Category.MIC     -> "🎤"
    Category.CAMERA  -> "📷"
    Category.CALL    -> "📞"
    Category.SYSTEM  -> "⚙"
    Category.APP     -> "📦"
    Category.NETWORK -> "🌐"
}
