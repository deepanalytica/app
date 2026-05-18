package com.audioplayer

import android.content.Intent
import androidx.annotation.OptIn
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

@OptIn(UnstableApi::class)
class PlayerService : MediaSessionService() {

    private var _player: ExoPlayer? = null
    private var _mediaSession: MediaSession? = null

    companion object {
        var equalizerManager: EqualizerManager? = null
        var instance: PlayerService? = null
    }

    override fun onCreate() {
        super.onCreate()
        instance = this

        _player = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true
            )
            .setHandleAudioBecomingNoisy(true)
            .build()

        _mediaSession = MediaSession.Builder(this, _player!!).build()

        _player!!.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY && equalizerManager == null) {
                    val sid = _player!!.audioSessionId
                    if (sid != 0) equalizerManager = EqualizerManager(sid)
                }
            }
        })
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = _mediaSession

    override fun onTaskRemoved(rootIntent: Intent?) {
        val player = _mediaSession?.player ?: return
        if (!player.playWhenReady || player.mediaItemCount == 0) stopSelf()
    }

    override fun onDestroy() {
        equalizerManager?.release()
        equalizerManager = null
        _mediaSession?.run {
            player.release()
            release()
        }
        _mediaSession = null
        _player = null
        instance = null
        super.onDestroy()
    }
}
