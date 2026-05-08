package com.photorecovery

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Process
import android.provider.MediaStore
import android.provider.Settings
import android.view.MenuItem
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class GuardianActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences
    private lateinit var adapter: EventAdapter
    private lateinit var textSince: TextView
    private lateinit var textSummary: TextView
    private lateinit var buttonStart: Button
    private lateinit var buttonCheck: Button
    private lateinit var layoutPerms: LinearLayout
    private lateinit var textPermUsage: TextView
    private lateinit var textPermFiles: TextView
    private lateinit var buttonGrantUsage: Button
    private lateinit var emptyView: View

    private val dateFmt = SimpleDateFormat("dd/MM HH:mm:ss", Locale.getDefault())

    private val watchedApps = mapOf(
        "com.miui.gallery"                  to "🖼 Galería MIUI",
        "com.miui.album"                    to "🖼 Álbum MIUI",
        "com.google.android.apps.photos"    to "🖼 Google Fotos",
        "com.whatsapp"                      to "💬 WhatsApp",
        "com.whatsapp.w4b"                  to "💬 WA Business",
        "org.telegram.messenger"            to "💬 Telegram",
        "org.thunderdog.challegram"         to "💬 Telegram X",
        "com.android.mms"                   to "📝 Mensajes",
        "com.google.android.apps.messaging" to "📝 Mensajes Google",
        "com.miui.fileexplorer"             to "📁 Explorador de archivos",
        "com.android.settings"              to "⚙️ Ajustes",
        "com.miui.securitycenter"           to "🔒 Seguridad MIUI",
        "com.miui.camera"                   to "📷 Cámara MIUI",
        "com.android.camera2"               to "📷 Cámara",
        "com.google.android.gm"             to "📧 Gmail",
        "com.facebook.katana"               to "📱 Facebook",
        "com.instagram.android"             to "📸 Instagram",
        "com.snapchat.android"              to "👻 Snapchat",
        "com.android.chrome"                to "🌐 Chrome",
        "com.android.contacts"              to "👤 Contactos",
        "com.android.dialer"                to "📞 Teléfono"
    )

    private val sentFolders = listOf(
        "WhatsApp/Media/WhatsApp Images/Sent"                                                  to "WhatsApp",
        "WhatsApp/Media/WhatsApp Video/Sent"                                                   to "WhatsApp",
        "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/Sent"                       to "WhatsApp",
        "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video/Sent"                        to "WhatsApp",
        "Android/media/com.whatsapp.w4b/WhatsApp Business/Media/WhatsApp Business Images/Sent" to "WA Business",
        "Telegram/Telegram Images"                                                             to "Telegram",
        "Telegram/Telegram Video"                                                              to "Telegram"
    )

    private val screenshotFolders = listOf(
        "MIUI/Screenshots", "Pictures/Screenshots", "DCIM/Screenshots"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Oculta el preview en el switcher de apps recientes
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        setContentView(R.layout.activity_guardian)

        setSupportActionBar(findViewById<Toolbar>(R.id.toolbarGuardian))
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "Guardián del teléfono"

        prefs            = getSharedPreferences("guardian", Context.MODE_PRIVATE)
        textSince        = findViewById(R.id.textSince)
        textSummary      = findViewById(R.id.textSummary)
        buttonStart      = findViewById(R.id.buttonStartGuard)
        buttonCheck      = findViewById(R.id.buttonCheckNow)
        layoutPerms      = findViewById(R.id.layoutPerms)
        textPermUsage    = findViewById(R.id.textPermUsage)
        textPermFiles    = findViewById(R.id.textPermFiles)
        buttonGrantUsage = findViewById(R.id.buttonGrantUsage)
        emptyView        = findViewById(R.id.emptyGuardian)

        val recycler = findViewById<RecyclerView>(R.id.recyclerEvents)
        adapter = EventAdapter()
        recycler.layoutManager = LinearLayoutManager(this)
        recycler.adapter = adapter

        buttonStart.setOnClickListener      { startGuarding() }
        buttonCheck.setOnClickListener      { checkWhatHappened() }
        buttonGrantUsage.setOnClickListener {
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionUI()
    }

    private fun hasUsagePerm(): Boolean {
        val ops  = getSystemService(APP_OPS_SERVICE) as AppOpsManager
        val mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun hasFilePerm(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.R || Environment.isExternalStorageManager()

    private fun refreshPermissionUI() {
        val usageOk = hasUsagePerm()
        val filesOk = hasFilePerm()

        textPermUsage.text = if (usageOk)
            "✅ Historial de apps: ACTIVADO"
        else
            "❌ Historial de apps: DESACTIVADO — toca el botón rojo"
        textPermUsage.setTextColor(if (usageOk) 0xFF388E3C.toInt() else 0xFFD32F2F.toInt())

        textPermFiles.text = if (filesOk)
            "✅ Acceso a archivos: ACTIVADO"
        else
            "⚠️ Acceso a archivos: DESACTIVADO (no se ven archivos enviados)"
        textPermFiles.setTextColor(if (filesOk) 0xFF388E3C.toInt() else 0xFFE65100.toInt())

        buttonGrantUsage.visibility = if (!usageOk) View.VISIBLE else View.GONE

        val since = prefs.getLong("guard_since", 0L)
        if (since > 0L) {
            textSince.text        = "Vigilando desde: ${dateFmt.format(Date(since))}"
            buttonCheck.isEnabled = true
        } else {
            textSince.text        = "Presiona Empezar y deja el teléfono"
            buttonCheck.isEnabled = false
        }
    }

    private fun startGuarding() {
        if (!hasUsagePerm()) {
            textSummary.text = "⚠️ Activa primero el permiso rojo de arriba"
            return
        }
        val now = System.currentTimeMillis()
        prefs.edit().putLong("guard_since", now).apply()
        textSince.text        = "Vigilando desde: ${dateFmt.format(Date(now))}"
        buttonCheck.isEnabled = true
        textSummary.text      = "🔒 Listo. Deja el teléfono y regresa cuando quieras revisar."
        adapter.setEvents(emptyList())
        emptyView.visibility  = View.GONE
    }

    private fun checkWhatHappened() {
        val since = prefs.getLong("guard_since", 0L)
        if (since == 0L) return

        val events = mutableListOf<EventItem>()
        if (hasUsagePerm()) {
            events += getScreenEvents(since)
            events += getAppSessions(since)
        }
        if (hasFilePerm()) {
            events += getNewSentFiles(since)
            events += getNewScreenshots(since)
        }
        events += getNewMedia(since)

        val sorted   = events.sortedBy { it.timestamp }
        adapter.setEvents(sorted)
        emptyView.visibility = if (sorted.isEmpty()) View.VISIBLE else View.GONE

        val screens = sorted.count { it.category == "screen" }
        val apps    = sorted.count { it.category == "app" }
        val sent    = sorted.count { it.category == "sent" }
        val shots   = sorted.count { it.category == "screenshot" }
        val photos  = sorted.count { it.category == "photo" }

        textSummary.text = if (sorted.isEmpty())
            "✅ Sin actividad detectada desde ${dateFmt.format(Date(since))}"
        else buildString {
            appendLine("⚠️ ${sorted.size} evento(s) detectado(s):")
            if (screens > 0) appendLine("🔓 Pantalla encendida: $screens vez/veces")
            if (apps    > 0) appendLine("📱 Apps abiertas: $apps (con duración)")
            if (sent    > 0) appendLine("📤 Archivos ENVIADOS: $sent")
            if (shots   > 0) appendLine("📸 Capturas de pantalla: $shots")
            if (photos  > 0) appendLine("📷 Fotos/videos nuevos: $photos")
        }.trimEnd()
    }

    private fun getScreenEvents(since: Long): List<EventItem> {
        val usm    = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val raw    = usm.queryEvents(since, System.currentTimeMillis())
        val result = mutableListOf<EventItem>()
        val ev     = UsageEvents.Event()
        while (raw.hasNextEvent()) {
            raw.getNextEvent(ev)
            if (ev.eventType == UsageEvents.Event.SCREEN_INTERACTIVE)
                result += EventItem(
                    timestamp = ev.timeStamp,
                    title     = "🔓 Pantalla encendida",
                    detail    = "Alguien encendió la pantalla",
                    category  = "screen"
                )
        }
        return result
    }

    private fun getAppSessions(since: Long): List<EventItem> {
        val usm      = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val raw      = usm.queryEvents(since, System.currentTimeMillis())
        val ev       = UsageEvents.Event()
        val openAt   = mutableMapOf<String, Long>()
        val sessions = mutableListOf<EventItem>()

        while (raw.hasNextEvent()) {
            raw.getNextEvent(ev)
            val appName = watchedApps[ev.packageName] ?: continue
            when (ev.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND ->
                    openAt[ev.packageName] = ev.timeStamp
                UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    val start = openAt.remove(ev.packageName) ?: continue
                    sessions += EventItem(
                        timestamp  = start,
                        title      = "$appName",
                        detail     = "Cerrada a las ${formatTime(ev.timeStamp)}",
                        category   = "app",
                        durationMs = ev.timeStamp - start
                    )
                }
            }
        }
        // apps todavía abiertas
        val now = System.currentTimeMillis()
        for ((pkg, start) in openAt) {
            val appName = watchedApps[pkg] ?: continue
            sessions += EventItem(
                timestamp  = start,
                title      = "$appName (aún activa)",
                detail     = "Todavía en uso",
                category   = "app",
                durationMs = now - start
            )
        }
        return sessions
    }

    private fun getNewSentFiles(since: Long): List<EventItem> {
        val sdcard = Environment.getExternalStorageDirectory()
        val result = mutableListOf<EventItem>()
        for ((path, app) in sentFolders) {
            val dir = File(sdcard, path)
            if (!dir.exists()) continue
            dir.listFiles()?.forEach { file ->
                if (file.isFile && file.lastModified() >= since)
                    result += EventItem(
                        timestamp = file.lastModified(),
                        title     = "📤 Archivo ENVIADO por $app",
                        detail    = file.name,
                        category  = "sent"
                    )
            }
        }
        return result
    }

    private fun getNewScreenshots(since: Long): List<EventItem> {
        val sdcard = Environment.getExternalStorageDirectory()
        val result = mutableListOf<EventItem>()
        for (path in screenshotFolders) {
            val dir = File(sdcard, path)
            if (!dir.exists()) continue
            dir.listFiles()?.forEach { file ->
                if (file.isFile && file.lastModified() >= since)
                    result += EventItem(
                        timestamp = file.lastModified(),
                        title     = "📸 Captura de pantalla tomada",
                        detail    = file.name,
                        category  = "screenshot"
                    )
            }
        }
        return result
    }

    private fun getNewMedia(since: Long): List<EventItem> {
        val result = mutableListOf<EventItem>()
        val sel    = "${MediaStore.MediaColumns.DATE_ADDED} >= ?"
        val args   = arrayOf((since / 1000).toString())
        val proj   = arrayOf(MediaStore.MediaColumns.DISPLAY_NAME, MediaStore.MediaColumns.DATE_ADDED)

        fun query(uri: android.net.Uri, label: String) {
            contentResolver.query(uri, proj, sel, args, null)?.use { c ->
                val nameCol = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
                val dateCol = c.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
                while (c.moveToNext())
                    result += EventItem(
                        timestamp = c.getLong(dateCol) * 1000,
                        title     = label,
                        detail    = c.getString(nameCol) ?: "",
                        category  = "photo"
                    )
            }
        }
        query(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, "📷 Nueva foto guardada")
        query(MediaStore.Video.Media.EXTERNAL_CONTENT_URI,  "🎬 Nuevo video guardado")
        return result
    }

    private fun formatTime(ms: Long) =
        SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(ms))

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == android.R.id.home) { finish(); return true }
        return super.onOptionsItemSelected(item)
    }
}
