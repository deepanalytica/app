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
import android.widget.Button
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
    private lateinit var buttonUsagePerm: Button
    private lateinit var emptyView: View

    private val dateFmt = SimpleDateFormat("dd/MM HH:mm:ss", Locale.getDefault())

    private val watchedApps = mapOf(
        "com.miui.gallery"                    to "🖼 Galería MIUI",
        "com.google.android.apps.photos"      to "🖼 Google Fotos",
        "com.whatsapp"                        to "💬 WhatsApp",
        "com.whatsapp.w4b"                    to "💬 WA Business",
        "org.telegram.messenger"              to "💬 Telegram",
        "org.thunderdog.challegram"           to "💬 Telegram X",
        "com.android.mms"                     to "📝 Mensajes",
        "com.google.android.apps.messaging"   to "📝 Mensajes Google",
        "com.miui.fileexplorer"               to "📁 Explorador de archivos",
        "com.android.settings"                to "⚙️ Ajustes",
        "com.miui.securitycenter"             to "🔒 Seguridad MIUI",
        "com.miui.camera"                     to "📷 Cámara",
        "com.android.camera2"                 to "📷 Cámara",
        "com.google.android.gm"               to "📧 Gmail",
        "com.google.android.apps.tachyon"     to "📹 Google Meet",
        "com.facebook.katana"                 to "📱 Facebook",
        "com.instagram.android"               to "📸 Instagram",
        "com.snapchat.android"                to "👻 Snapchat",
        "com.android.chrome"                  to "🌐 Chrome",
        "com.miui.notes"                      to "📝 Notas",
        "com.android.contacts"                to "👤 Contactos",
        "com.android.dialer"                  to "📞 Teléfono"
    )

    private val sentFolders = listOf(
        "WhatsApp/Media/WhatsApp Images/Sent" to "WhatsApp",
        "WhatsApp/Media/WhatsApp Video/Sent" to "WhatsApp",
        "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images/Sent" to "WhatsApp",
        "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video/Sent" to "WhatsApp",
        "Android/media/com.whatsapp.w4b/WhatsApp Business/Media/WhatsApp Business Images/Sent" to "WA Business",
        "Telegram/Telegram Images" to "Telegram",
        "Telegram/Telegram Video" to "Telegram"
    )

    private val screenshotFolders = listOf(
        "MIUI/Screenshots",
        "Pictures/Screenshots",
        "DCIM/Screenshots"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_guardian)

        setSupportActionBar(findViewById<Toolbar>(R.id.toolbarGuardian))
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "Guardián del teléfono"

        prefs = getSharedPreferences("guardian", Context.MODE_PRIVATE)
        textSince       = findViewById(R.id.textSince)
        textSummary     = findViewById(R.id.textSummary)
        buttonStart     = findViewById(R.id.buttonStartGuard)
        buttonCheck     = findViewById(R.id.buttonCheckNow)
        buttonUsagePerm = findViewById(R.id.buttonUsagePerm)
        emptyView       = findViewById(R.id.emptyGuardian)

        val recycler = findViewById<RecyclerView>(R.id.recyclerEvents)
        adapter = EventAdapter()
        recycler.layoutManager = LinearLayoutManager(this)
        recycler.adapter = adapter

        buttonStart.setOnClickListener     { startGuarding() }
        buttonCheck.setOnClickListener     { checkWhatHappened() }
        buttonUsagePerm.setOnClickListener {
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }

        updateUI()
    }

    override fun onResume() {
        super.onResume()
        updateUI()
    }

    private fun updateUI() {
        buttonUsagePerm.visibility = if (!hasUsageStatsPermission()) View.VISIBLE else View.GONE
        val since = prefs.getLong("guard_since", 0L)
        if (since > 0L) {
            textSince.text = "Vigilando desde: ${dateFmt.format(Date(since))}"
            buttonCheck.isEnabled = true
        } else {
            textSince.text = "Presiona \"Empezar\" y deja el teléfono"
            buttonCheck.isEnabled = false
        }
    }

    private fun startGuarding() {
        val now = System.currentTimeMillis()
        prefs.edit().putLong("guard_since", now).apply()
        textSince.text = "Vigilando desde: ${dateFmt.format(Date(now))}"
        buttonCheck.isEnabled = true
        textSummary.text = "Listo. Deja el teléfono y vuelve cuando quieras revisar."
        adapter.setEvents(emptyList())
        emptyView.visibility = View.GONE
    }

    private fun checkWhatHappened() {
        val since = prefs.getLong("guard_since", 0L)
        if (since == 0L) return

        val events = mutableListOf<EventItem>()

        if (hasUsageStatsPermission()) {
            events += getScreenOnEvents(since)
            events += getAppOpenEvents(since)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && Environment.isExternalStorageManager()) {
            events += getNewSentFiles(since)
            events += getNewScreenshots(since)
        }

        events += getNewMediaFromCamera(since)

        val sorted = events.sortedBy { it.timestamp }
        adapter.setEvents(sorted)
        emptyView.visibility = if (sorted.isEmpty()) View.VISIBLE else View.GONE

        val screenCount = sorted.count { it.category == "screen" }
        val appCount    = sorted.count { it.category == "app" }
        val sentCount   = sorted.count { it.category == "sent" }
        val shotCount   = sorted.count { it.category == "screenshot" }
        val photoCount  = sorted.count { it.category == "photo" }

        textSummary.text = if (sorted.isEmpty())
            "✅ Nadie usó el teléfono desde las ${dateFmt.format(Date(since))}"
        else
            "⚠️ ${sorted.size} evento(s) detectado(s):\n" +
            "🔓 Pantalla encendida $screenCount vez/veces\n" +
            "📱 Apps abiertas: $appCount\n" +
            "📤 Archivos enviados: $sentCount\n" +
            "📸 Capturas de pantalla: $shotCount\n" +
            "📷 Fotos/videos nuevos: $photoCount"
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = getSystemService(APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun getScreenOnEvents(since: Long): List<EventItem> {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val usageEvents = usm.queryEvents(since, System.currentTimeMillis())
        val result = mutableListOf<EventItem>()
        val ev = UsageEvents.Event()
        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(ev)
            if (ev.eventType == UsageEvents.Event.SCREEN_INTERACTIVE) {
                result.add(EventItem(
                    timestamp = ev.timeStamp,
                    title = "🔓 Pantalla encendida",
                    detail = "Alguien encendió la pantalla del teléfono",
                    category = "screen"
                ))
            }
        }
        return result
    }

    private fun getAppOpenEvents(since: Long): List<EventItem> {
        val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val usageEvents = usm.queryEvents(since, System.currentTimeMillis())
        val result = mutableListOf<EventItem>()
        val ev = UsageEvents.Event()
        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(ev)
            if (ev.eventType != UsageEvents.Event.MOVE_TO_FOREGROUND) continue
            val appName = watchedApps[ev.packageName] ?: continue
            result.add(EventItem(
                timestamp = ev.timeStamp,
                title = "$appName abierta",
                detail = ev.packageName,
                category = "app"
            ))
        }
        return result
    }

    private fun getNewSentFiles(since: Long): List<EventItem> {
        val sdcard = Environment.getExternalStorageDirectory()
        val result = mutableListOf<EventItem>()
        for ((path, app) in sentFolders) {
            val dir = File(sdcard, path)
            if (!dir.exists()) continue
            dir.listFiles()?.forEach { file ->
                if (file.isFile && file.lastModified() >= since) {
                    result.add(EventItem(
                        timestamp = file.lastModified(),
                        title = "📤 Archivo ENVIADO por $app",
                        detail = file.name,
                        category = "sent"
                    ))
                }
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
                if (file.isFile && file.lastModified() >= since) {
                    result.add(EventItem(
                        timestamp = file.lastModified(),
                        title = "📸 Captura de pantalla tomada",
                        detail = file.name,
                        category = "screenshot"
                    ))
                }
            }
        }
        return result
    }

    private fun getNewMediaFromCamera(since: Long): List<EventItem> {
        val result = mutableListOf<EventItem>()
        val sinceSeconds = since / 1000
        val selection = "${MediaStore.MediaColumns.DATE_ADDED} >= ?"
        val args = arrayOf(sinceSeconds.toString())
        val projection = arrayOf(
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.DATE_ADDED
        )

        contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI, projection, selection, args, null
        )?.use { cursor ->
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
            while (cursor.moveToNext()) {
                result.add(EventItem(
                    timestamp = cursor.getLong(dateCol) * 1000,
                    title = "📷 Nueva foto guardada en el teléfono",
                    detail = cursor.getString(nameCol) ?: "",
                    category = "photo"
                ))
            }
        }

        contentResolver.query(
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI, projection, selection, args, null
        )?.use { cursor ->
            val nameCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
            val dateCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
            while (cursor.moveToNext()) {
                result.add(EventItem(
                    timestamp = cursor.getLong(dateCol) * 1000,
                    title = "🎬 Nuevo video guardado en el teléfono",
                    detail = cursor.getString(nameCol) ?: "",
                    category = "photo"
                ))
            }
        }
        return result
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == android.R.id.home) { finish(); return true }
        return super.onOptionsItemSelected(item)
    }
}
