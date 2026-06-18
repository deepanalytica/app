package com.securityguard

import android.app.AppOpsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Process
import android.provider.Settings
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object SecurityScanner {

    fun runFullScan(context: Context): List<SecurityAlert> {
        val alerts = mutableListOf<SecurityAlert>()
        alerts += scanRoot()
        alerts += scanDeveloperOptions(context)
        alerts += scanMicCameraUsageHistory(context)
        alerts += scanDangerousApps(context)
        alerts += scanCallForwarding()
        return alerts
    }

    // ── Root detection ────────────────────────────────────────────────────────

    fun scanRoot(): List<SecurityAlert> {
        val alerts = mutableListOf<SecurityAlert>()

        val suPaths = listOf(
            "/sbin/su", "/system/bin/su", "/system/xbin/su",
            "/data/local/xbin/su", "/data/local/bin/su", "/data/local/su",
            "/system/sd/xbin/su", "/system/bin/failsafe/su"
        )
        val hasRoot = suPaths.any { File(it).exists() }

        if (hasRoot) {
            alerts += SecurityAlert(
                title = "Dispositivo con ROOT detectado",
                detail = "El teléfono tiene acceso root activo. Esto permite a apps maliciosas acceder a mic, cámara y datos sin restricciones.",
                severity = Severity.CRITICAL,
                category = Category.SYSTEM
            )
        }

        val magiskDir = File("/data/adb/magisk")
        if (magiskDir.exists()) {
            alerts += SecurityAlert(
                title = "Magisk detectado",
                detail = "Magisk (framework de root) encontrado en el sistema.",
                severity = Severity.CRITICAL,
                category = Category.SYSTEM
            )
        }

        return alerts
    }

    // ── Developer options ─────────────────────────────────────────────────────

    fun scanDeveloperOptions(context: Context): List<SecurityAlert> {
        val alerts = mutableListOf<SecurityAlert>()

        val adbEnabled = Settings.Global.getInt(context.contentResolver, Settings.Global.ADB_ENABLED, 0)
        if (adbEnabled == 1) {
            alerts += SecurityAlert(
                title = "Depuración USB (ADB) activa",
                detail = "Cualquier computadora conectada puede instalar apps, extraer datos o controlar el teléfono. Desactiva en Opciones de Desarrollador.",
                severity = Severity.HIGH,
                category = Category.SYSTEM
            )
        }

        val devEnabled = Settings.Global.getInt(context.contentResolver, Settings.Global.DEVELOPMENT_SETTINGS_ENABLED, 0)
        if (devEnabled == 1) {
            alerts += SecurityAlert(
                title = "Opciones de desarrollador activadas",
                detail = "Las opciones de desarrollador permiten configuraciones peligrosas. Desactívalas si no eres desarrollador.",
                severity = Severity.MEDIUM,
                category = Category.SYSTEM
            )
        }

        val unknownSources = Settings.Secure.getInt(context.contentResolver, Settings.Secure.INSTALL_NON_MARKET_APPS, 0)
        if (unknownSources == 1) {
            alerts += SecurityAlert(
                title = "Instalación de fuentes desconocidas",
                detail = "El teléfono permite instalar apps fuera de Play Store. Esto puede permitir spyware.",
                severity = Severity.HIGH,
                category = Category.SYSTEM
            )
        }

        return alerts
    }

    // ── Mic/Camera usage history ──────────────────────────────────────────────

    fun scanMicCameraUsageHistory(context: Context): List<SecurityAlert> {
        val alerts = mutableListOf<SecurityAlert>()
        val appOps  = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val pm      = context.packageManager
        val since   = System.currentTimeMillis() - 24 * 60 * 60 * 1000L // last 24h

        val opsToCheck = listOf(
            AppOpsManager.OPSTR_RECORD_AUDIO to Category.MIC,
            AppOpsManager.OPSTR_CAMERA       to Category.CAMERA
        )

        for ((op, category) in opsToCheck) {
            try {
                val m = AppOpsManager::class.java.getDeclaredMethod("getPackagesForOps", Array<String>::class.java)
                @Suppress("UNCHECKED_CAST")
                val packages = m.invoke(appOps, arrayOf(op)) as List<AppOpsManager.PackageOps>
                for (pkgOps in packages) {
                    val pkg = pkgOps.packageName
                    if (pkg == context.packageName) continue

                    for (opEntry in pkgOps.ops) {
                        val lastAccess = opEntry.lastAccessTime
                        if (lastAccess > since) {
                            val appName = try {
                                pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
                            } catch (e: Exception) { pkg }

                            alerts += SecurityAlert(
                                title = "${category.icon()} $appName accedió ${if (category == Category.MIC) "al micrófono" else "a la cámara"}",
                                detail = "Última vez: ${formatTime(lastAccess)}\nPaquete: $pkg",
                                severity = if (isKnownSafe(pkg)) Severity.INFO else Severity.MEDIUM,
                                category = category,
                                packageName = pkg
                            )
                        }
                    }
                }
            } catch (e: SecurityException) {
                // PACKAGE_USAGE_STATS not granted — handled in UI
            }
        }

        return alerts
    }

    // ── Apps with dangerous permissions ──────────────────────────────────────

    fun scanDangerousApps(context: Context): List<SecurityAlert> {
        val alerts = mutableListOf<SecurityAlert>()
        val pm = context.packageManager

        val dangerousPerms = listOf(
            android.Manifest.permission.RECORD_AUDIO,
            android.Manifest.permission.CAMERA,
            android.Manifest.permission.ACCESS_FINE_LOCATION,
            android.Manifest.permission.READ_CONTACTS,
            android.Manifest.permission.READ_SMS,
            android.Manifest.permission.READ_CALL_LOG
        )

        try {
            val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            for (app in apps) {
                if (app.packageName == context.packageName) continue

                val isSystem = (app.flags and ApplicationInfo.FLAG_SYSTEM) != 0

                val grantedDanger = dangerousPerms.count { perm ->
                    pm.checkPermission(perm, app.packageName) == PackageManager.PERMISSION_GRANTED
                }

                if (!isSystem && grantedDanger >= 4) {
                    val appName = pm.getApplicationLabel(app).toString()
                    val permNames = dangerousPerms.filter { perm ->
                        pm.checkPermission(perm, app.packageName) == PackageManager.PERMISSION_GRANTED
                    }.joinToString(", ") { it.substringAfterLast('.') }

                    alerts += SecurityAlert(
                        title = "App sospechosa: $appName",
                        detail = "Tiene $grantedDanger permisos peligrosos: $permNames",
                        severity = Severity.HIGH,
                        category = Category.APP,
                        packageName = app.packageName
                    )
                }
            }
        } catch (e: Exception) { /* skip */ }

        return alerts
    }

    // ── Call forwarding ───────────────────────────────────────────────────────

    fun scanCallForwarding(): List<SecurityAlert> {
        return listOf(
            SecurityAlert(
                title = "Verificar desvío de llamadas",
                detail = "Usa el botón 'Desvío llamadas' para comprobar si tus llamadas están siendo redirigidas a un número externo.",
                severity = Severity.INFO,
                category = Category.CALL
            )
        )
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private val safePkgPrefixes = listOf(
        "com.google.", "com.android.", "android.", "com.miui.",
        "com.xiaomi.", "com.qualcomm.", "com.sec.", "org.chromium."
    )

    fun isKnownSafe(pkg: String) = safePkgPrefixes.any { pkg.startsWith(it) }

    private fun formatTime(ms: Long): String {
        val sdf = SimpleDateFormat("dd/MM HH:mm", Locale.getDefault())
        return sdf.format(Date(ms))
    }
}
