package com.securityguard

import android.app.AppOpsManager
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.camera2.CameraManager
import android.os.IBinder
import androidx.core.app.NotificationCompat
import java.util.concurrent.atomic.AtomicInteger

class MonitorService : Service() {

    private lateinit var appOps: AppOpsManager
    private lateinit var cameraManager: CameraManager
    private val alertId = AtomicInteger(1000)

    private val micListener = AppOpsManager.OnOpChangedListener { op, packageName ->
        if (packageName == this.packageName) return@OnOpChangedListener
        val uid = try {
            packageManager.getApplicationInfo(packageName, 0).uid
        } catch (e: Exception) { return@OnOpChangedListener }

        val mode = appOps.unsafeCheckOpNoThrow(op, uid, packageName)
        if (mode == AppOpsManager.MODE_ALLOWED) {
            sendSecurityAlert(
                title = "Micrófono en uso",
                text  = getAppName(packageName) + " está accediendo al micrófono ahora",
                pkg   = packageName,
                cat   = Category.MIC
            )
        }
    }

    private val cameraAvailabilityCallback = object : CameraManager.AvailabilityCallback() {
        override fun onCameraUnavailable(cameraId: String) {
            val pkg = getAppUsingCamera()
            val name = if (pkg != null) getAppName(pkg) else "Una app desconocida"
            sendSecurityAlert(
                title = "Camara en uso",
                text  = "$name está usando la cámara ahora",
                pkg   = pkg,
                cat   = Category.CAMERA
            )
        }

        override fun onCameraAvailable(cameraId: String) {
            // Camera released — no alert needed
        }
    }

    override fun onCreate() {
        super.onCreate()
        appOps        = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        cameraManager = getSystemService(Context.CAMERA_SERVICE) as CameraManager

        startForeground(NOTIF_ID, buildPersistentNotification())
        registerMicListener()
        registerCameraListener()
    }

    private fun registerMicListener() {
        try {
            appOps.startWatchingMode(
                AppOpsManager.OPSTR_RECORD_AUDIO,
                null,
                micListener
            )
        } catch (e: Exception) { /* PACKAGE_USAGE_STATS not granted */ }
    }

    private fun registerCameraListener() {
        try {
            cameraManager.registerAvailabilityCallback(cameraAvailabilityCallback, null)
        } catch (e: Exception) { /* ignore */ }
    }

    private fun sendSecurityAlert(title: String, text: String, pkg: String?, cat: Category) {
        val nm     = getSystemService(NotificationManager::class.java)
        val intent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notif = NotificationCompat.Builder(this, App.CHANNEL_ALERT)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(title)
            .setContentText(text)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(intent)
            .setAutoCancel(true)
            .build()

        nm.notify(alertId.getAndIncrement(), notif)

        // Broadcast to MainActivity so it can add to the live list
        val broadcast = Intent(ACTION_NEW_ALERT).apply {
            putExtra(EXTRA_TITLE,   title)
            putExtra(EXTRA_DETAIL,  text)
            putExtra(EXTRA_PACKAGE, pkg ?: "")
            putExtra(EXTRA_CAT,     cat.name)
        }
        sendBroadcast(broadcast)
    }

    private fun buildPersistentNotification(): Notification {
        val intent = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, App.CHANNEL_MONITOR)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentTitle("SecurityGuard activo")
            .setContentText("Monitoreando mic y cámara en tiempo real")
            .setContentIntent(intent)
            .setOngoing(true)
            .build()
    }

    private fun getAppName(pkg: String): String = try {
        packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
    } catch (e: Exception) { pkg }

    private fun getAppUsingCamera(): String? {
        return try {
            val pkgOps = appOps.getPackagesForOps(arrayOf(AppOpsManager.OPSTR_CAMERA))
            pkgOps.firstOrNull { ops ->
                ops.packageName != packageName &&
                ops.ops.any { it.op == AppOpsManager.strOpToOp(AppOpsManager.OPSTR_CAMERA) }
            }?.packageName
        } catch (e: Exception) { null }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        try { appOps.stopWatchingMode(micListener) } catch (e: Exception) {}
        try { cameraManager.unregisterAvailabilityCallback(cameraAvailabilityCallback) } catch (e: Exception) {}
        super.onDestroy()
    }

    companion object {
        const val NOTIF_ID          = 1
        const val ACTION_NEW_ALERT  = "com.securityguard.NEW_ALERT"
        const val EXTRA_TITLE       = "extra_title"
        const val EXTRA_DETAIL      = "extra_detail"
        const val EXTRA_PACKAGE     = "extra_package"
        const val EXTRA_CAT         = "extra_cat"
    }
}
