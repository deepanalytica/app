package com.audioplayer

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.SeekBar
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.audioplayer.databinding.ActivityAudioEditorBinding
import kotlinx.coroutines.launch
import java.io.File

class AudioEditorActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAudioEditorBinding
    private var audioUri: Uri? = null
    private var durationMs = 0L
    private var startMs    = 0L
    private var endMs      = 0L

    companion object {
        const val EXTRA_URI = "extra_uri"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAudioEditorBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.title = "Editor de Audio"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        @Suppress("DEPRECATION")
        audioUri = intent.getParcelableExtra(EXTRA_URI)
        if (audioUri == null) { finish(); return }

        binding.tvFileName.text = audioUri!!.lastPathSegment ?: "archivo de audio"
        loadWaveform()
        setupSeekBars()
        setupButtons()
    }

    // ── Waveform ──────────────────────────────────────────────────────────────

    private fun loadWaveform() {
        binding.progressLoading.visibility = View.VISIBLE
        binding.waveformView.visibility    = View.INVISIBLE

        lifecycleScope.launch {
            val (samples, dur) = WaveformLoader.load(this@AudioEditorActivity, audioUri!!)
            durationMs = dur
            endMs      = dur

            binding.waveformView.setSamples(samples, dur)
            binding.waveformView.onSelectionChanged = { s, e ->
                startMs = s; endMs = e
                syncSeekBarsFromSelection()
                updateTimeDisplay()
            }

            binding.progressLoading.visibility = View.GONE
            binding.waveformView.visibility    = View.VISIBLE

            binding.seekEnd.progress = 1000
            updateTimeDisplay()
        }
    }

    // ── SeekBars ──────────────────────────────────────────────────────────────

    private fun setupSeekBars() {
        binding.seekStart.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                if (!fromUser || durationMs == 0L) return
                startMs = progress.toLong() * durationMs / 1000L
                if (startMs >= endMs) endMs = (startMs + 1000L).coerceAtMost(durationMs)
                binding.waveformView.setSelection(startMs, endMs)
                updateTimeDisplay()
            }
            override fun onStartTrackingTouch(sb: SeekBar) {}
            override fun onStopTrackingTouch(sb: SeekBar) {}
        })

        binding.seekEnd.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                if (!fromUser || durationMs == 0L) return
                endMs = progress.toLong() * durationMs / 1000L
                if (endMs <= startMs) startMs = (endMs - 1000L).coerceAtLeast(0L)
                binding.waveformView.setSelection(startMs, endMs)
                updateTimeDisplay()
            }
            override fun onStartTrackingTouch(sb: SeekBar) {}
            override fun onStopTrackingTouch(sb: SeekBar) {}
        })
    }

    private fun syncSeekBarsFromSelection() {
        if (durationMs == 0L) return
        binding.seekStart.progress = (startMs * 1000L / durationMs).toInt()
        binding.seekEnd.progress   = (endMs   * 1000L / durationMs).toInt()
    }

    // ── Buttons ───────────────────────────────────────────────────────────────

    private fun setupButtons() {
        binding.btnPreview.setOnClickListener {
            if (durationMs == 0L) { Toast.makeText(this, "Cargando audio…", Toast.LENGTH_SHORT).show(); return@setOnClickListener }
            val result = Intent().apply {
                putExtra(EXTRA_URI, audioUri)
                putExtra("seek_to_ms", startMs)
            }
            setResult(RESULT_FIRST_USER, result)
            Toast.makeText(this, "Reproduciendo desde ${formatTime(startMs)}", Toast.LENGTH_SHORT).show()
        }

        binding.btnExport.setOnClickListener { exportSegment() }
    }

    // ── Export ────────────────────────────────────────────────────────────────

    private fun exportSegment() {
        if (endMs <= startMs + 500) {
            Toast.makeText(this, "Selecciona al menos 0.5 segundos", Toast.LENGTH_SHORT).show()
            return
        }

        binding.progressExport.visibility = View.VISIBLE
        binding.progressExport.progress   = 0
        binding.btnExport.isEnabled = false
        binding.btnPreview.isEnabled = false

        val outDir  = File(getExternalFilesDir(null), "AudioEditados").apply { mkdirs() }
        val outFile = File(outDir, "corte_${System.currentTimeMillis()}.m4a")

        lifecycleScope.launch {
            val ok = AudioSegmentExtractor.extract(
                this@AudioEditorActivity, audioUri!!, startMs, endMs, outFile
            ) { progress ->
                runOnUiThread { binding.progressExport.progress = progress }
            }

            binding.progressExport.visibility = View.GONE
            binding.btnExport.isEnabled  = true
            binding.btnPreview.isEnabled = true

            if (ok) {
                AlertDialog.Builder(this@AudioEditorActivity, R.style.DarkDialog)
                    .setTitle("Corte guardado")
                    .setMessage(
                        "Segmento: ${formatTime(startMs)} → ${formatTime(endMs)}\n" +
                        "Duracion: ${formatTime(endMs - startMs)}\n\n" +
                        "Guardado en:\n${outFile.name}"
                    )
                    .setPositiveButton("OK", null)
                    .setNeutralButton("Reproducir ahora") { _, _ ->
                        setResult(RESULT_OK, Intent().apply { data = Uri.fromFile(outFile) })
                        finish()
                    }
                    .show()
            } else {
                Toast.makeText(this@AudioEditorActivity, "Error al exportar. Verifica el archivo.", Toast.LENGTH_LONG).show()
            }
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun updateTimeDisplay() {
        binding.tvStartTime.text = "Inicio: ${formatTime(startMs)}"
        binding.tvEndTime.text   = "Fin: ${formatTime(endMs)}"
        binding.tvSegment.text   = "Duracion: ${formatTime(endMs - startMs)}"
    }

    private fun formatTime(ms: Long): String {
        val m   = ms / 60000L
        val s   = (ms % 60000L) / 1000L
        val dec = (ms % 1000L) / 100L
        return "%d:%02d.%d".format(m, s, dec)
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
