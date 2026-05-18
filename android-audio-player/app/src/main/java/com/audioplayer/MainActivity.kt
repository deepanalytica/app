package com.audioplayer

import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.CountDownTimer
import android.os.Handler
import android.os.Looper
import android.widget.SeekBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.OptIn
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.audioplayer.databinding.ActivityMainBinding
import com.bumptech.glide.Glide
import com.google.common.util.concurrent.ListenableFuture
import java.util.concurrent.Executor
import java.util.concurrent.TimeUnit

@OptIn(UnstableApi::class)
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var controllerFuture: ListenableFuture<MediaController>? = null
    private var controller: MediaController? = null
    private val handler = Handler(Looper.getMainLooper())
    private var sleepTimer: CountDownTimer? = null
    private var currentSpeed = 1.0f

    private val updateProgress = object : Runnable {
        override fun run() {
            updateProgressBar()
            handler.postDelayed(this, 500)
        }
    }

    private val pickAudio = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        uri?.let { loadAudio(it) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setupUI()
    }

    override fun onStart() {
        super.onStart()
        val token = SessionToken(this, ComponentName(this, PlayerService::class.java))
        controllerFuture = MediaController.Builder(this, token).buildAsync()
        controllerFuture!!.addListener({
            controller = controllerFuture!!.get()
            onControllerReady()
        }, Executor { it.run() })
    }

    override fun onStop() {
        handler.removeCallbacks(updateProgress)
        MediaController.releaseFuture(controllerFuture ?: return)
        controller = null
        super.onStop()
    }

    private fun setupUI() {
        binding.btnOpen.setOnClickListener {
            pickAudio.launch(arrayOf("audio/*"))
        }

        binding.btnPlayPause.setOnClickListener {
            val c = controller ?: return@setOnClickListener
            if (c.isPlaying) c.pause() else c.play()
        }

        binding.btnPrev.setOnClickListener { controller?.seekToPreviousMediaItem() }
        binding.btnNext.setOnClickListener { controller?.seekToNextMediaItem() }

        binding.btnEqualizer.setOnClickListener {
            startActivity(Intent(this, EqualizerActivity::class.java))
        }

        binding.seekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    val duration = controller?.duration ?: return
                    if (duration > 0) controller?.seekTo((progress.toLong() * duration) / 1000)
                }
            }
            override fun onStartTrackingTouch(sb: SeekBar) {}
            override fun onStopTrackingTouch(sb: SeekBar) {}
        })

        binding.chipSpeed05.setOnClickListener { setSpeed(0.5f) }
        binding.chipSpeed075.setOnClickListener { setSpeed(0.75f) }
        binding.chipSpeed1.setOnClickListener { setSpeed(1.0f) }
        binding.chipSpeed125.setOnClickListener { setSpeed(1.25f) }
        binding.chipSpeed15.setOnClickListener { setSpeed(1.5f) }
        binding.chipSpeed2.setOnClickListener { setSpeed(2.0f) }
        binding.chipSpeed3.setOnClickListener { setSpeed(3.0f) }

        binding.btnSleep.setOnClickListener { showSleepTimerDialog() }
        binding.btnRepeat.setOnClickListener { toggleRepeat() }
    }

    private fun onControllerReady() {
        val c = controller ?: return
        c.addListener(object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                binding.btnPlayPause.text = if (isPlaying) "⏸" else "▶"
                if (isPlaying) handler.post(updateProgress)
                else handler.removeCallbacks(updateProgress)
            }
            override fun onMediaMetadataChanged(metadata: MediaMetadata) {
                updateMetadata(metadata)
            }
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY) updateProgressBar()
            }
        })

        if (c.mediaItemCount > 0) updateMetadata(c.mediaMetadata)

        intent?.data?.let { loadAudio(it) }
    }

    private fun loadAudio(uri: Uri) {
        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (e: SecurityException) {
            // URI may not support persistable permissions (e.g. direct file URIs), ignore
        }
        val mediaItem = MediaItem.Builder()
            .setUri(uri)
            .build()
        controller?.apply {
            setMediaItem(mediaItem)
            prepare()
            play()
        }
    }

    private fun updateMetadata(metadata: MediaMetadata) {
        binding.tvTitle.text = metadata.title ?: "Sin título"
        binding.tvArtist.text = metadata.artist ?: "Artista desconocido"
        val artUri = metadata.artworkUri
        if (artUri != null) {
            Glide.with(this).load(artUri).circleCrop().placeholder(R.drawable.ic_music_note)
                .into(binding.imgAlbumArt)
        } else {
            binding.imgAlbumArt.setImageResource(R.drawable.ic_music_note)
        }
    }

    private fun updateProgressBar() {
        val c = controller ?: return
        val duration = c.duration.takeIf { it > 0 } ?: return
        val position = c.currentPosition
        binding.seekBar.progress = ((position * 1000) / duration).toInt()
        binding.tvCurrentTime.text = formatTime(position)
        binding.tvTotalTime.text = formatTime(duration)
    }

    private fun formatTime(ms: Long): String {
        val h = TimeUnit.MILLISECONDS.toHours(ms)
        val m = TimeUnit.MILLISECONDS.toMinutes(ms) % 60
        val s = TimeUnit.MILLISECONDS.toSeconds(ms) % 60
        return if (h > 0) String.format("%d:%02d:%02d", h, m, s)
        else String.format("%d:%02d", m, s)
    }

    private fun setSpeed(speed: Float) {
        currentSpeed = speed
        controller?.setPlaybackSpeed(speed)
        listOf(
            binding.chipSpeed05 to 0.5f,
            binding.chipSpeed075 to 0.75f,
            binding.chipSpeed1 to 1.0f,
            binding.chipSpeed125 to 1.25f,
            binding.chipSpeed15 to 1.5f,
            binding.chipSpeed2 to 2.0f,
            binding.chipSpeed3 to 3.0f
        ).forEach { (chip, s) ->
            chip.isSelected = s == speed
        }
    }

    private fun toggleRepeat() {
        val c = controller ?: return
        c.repeatMode = when (c.repeatMode) {
            Player.REPEAT_MODE_OFF -> Player.REPEAT_MODE_ONE
            Player.REPEAT_MODE_ONE -> Player.REPEAT_MODE_ALL
            else -> Player.REPEAT_MODE_OFF
        }
        binding.btnRepeat.text = when (c.repeatMode) {
            Player.REPEAT_MODE_ONE -> "🔂"
            Player.REPEAT_MODE_ALL -> "🔁"
            else -> "↩"
        }
    }

    private fun showSleepTimerDialog() {
        val options = arrayOf("15 minutos", "30 minutos", "45 minutos", "60 minutos", "Cancelar timer")
        AlertDialog.Builder(this, R.style.DarkDialog)
            .setTitle("Temporizador de sueno")
            .setItems(options) { _, which ->
                when (which) {
                    4 -> cancelSleepTimer()
                    else -> setSleepTimer(listOf(15L, 30L, 45L, 60L)[which])
                }
            }
            .show()
    }

    private fun setSleepTimer(minutes: Long) {
        cancelSleepTimer()
        sleepTimer = object : CountDownTimer(minutes * 60 * 1000, 1000) {
            override fun onTick(remaining: Long) {
                val min = remaining / 60000
                val sec = (remaining % 60000) / 1000
                binding.btnSleep.text = "${min}:${String.format("%02d", sec)}"
            }
            override fun onFinish() {
                controller?.pause()
                binding.btnSleep.text = "ZZZ"
                Toast.makeText(this@MainActivity, "Temporizador finalizado", Toast.LENGTH_SHORT).show()
            }
        }.start()
        Toast.makeText(this, "Timer: ${minutes} min", Toast.LENGTH_SHORT).show()
    }

    private fun cancelSleepTimer() {
        sleepTimer?.cancel()
        sleepTimer = null
        binding.btnSleep.text = "ZZZ"
    }
}
