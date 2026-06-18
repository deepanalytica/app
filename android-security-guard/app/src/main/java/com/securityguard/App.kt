package com.securityguard

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        val nm = getSystemService(NotificationManager::class.java)

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_MONITOR, "Monitor activo", NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Servicio de monitoreo de mic y cámara" })

        nm.createNotificationChannel(NotificationChannel(
            CHANNEL_ALERT, "Alertas de seguridad", NotificationManager.IMPORTANCE_HIGH
        ).apply { description = "Alertas cuando una app accede al mic o cámara" })
    }

    companion object {
        const val CHANNEL_MONITOR = "monitor_channel"
        const val CHANNEL_ALERT   = "alert_channel"
    }
}
