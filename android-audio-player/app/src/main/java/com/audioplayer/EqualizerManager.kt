package com.audioplayer

import android.media.audiofx.BassBoost
import android.media.audiofx.Equalizer
import android.media.audiofx.LoudnessEnhancer
import android.media.audiofx.Virtualizer

data class EqPreset(val name: String, val bands: List<Short>)

val EQ_PRESETS = listOf(
    EqPreset("Plana",    listOf(0, 0, 0, 0, 0).map(Int::toShort)),
    EqPreset("Pop",      listOf(-200, 400, 600, 400, -100).map(Int::toShort)),
    EqPreset("Rock",     listOf(500, 200, -200, 300, 500).map(Int::toShort)),
    EqPreset("Jazz",     listOf(300, 200, 0, 200, 300).map(Int::toShort)),
    EqPreset("Clásica",  listOf(500, 300, -200, 200, 500).map(Int::toShort)),
    EqPreset("Podcast",  listOf(-300, 100, 600, 400, -200).map(Int::toShort)),
    EqPreset("Voz",      listOf(-500, 0, 700, 300, -300).map(Int::toShort)),
    EqPreset("Graves++", listOf(800, 600, 0, -200, -300).map(Int::toShort)),
    EqPreset("Agudos++", listOf(-300, -200, 0, 600, 800).map(Int::toShort)),
)

class EqualizerManager(private val sessionId: Int) {

    val equalizer: Equalizer? = try {
        Equalizer(0, sessionId).apply { enabled = true }
    } catch (e: Exception) { null }

    val bassBoost: BassBoost? = try {
        BassBoost(0, sessionId).apply { enabled = true }
    } catch (e: Exception) { null }

    val virtualizer: Virtualizer? = try {
        Virtualizer(0, sessionId).apply { enabled = true }
    } catch (e: Exception) { null }

    val loudness: LoudnessEnhancer? = try {
        LoudnessEnhancer(sessionId).apply { enabled = false }
    } catch (e: Exception) { null }

    val bandCount: Int get() = equalizer?.numberOfBands?.toInt() ?: 5
    val bandLevelRange: ShortArray get() = equalizer?.bandLevelRange ?: shortArrayOf(-1500, 1500)

    fun getCenterFreqLabel(band: Int): String {
        val hz = (equalizer?.getCenterFreq(band.toShort()) ?: 0) / 1000
        return if (hz >= 1000) "${hz / 1000}kHz" else "${hz}Hz"
    }

    fun getBandLevel(band: Int): Short = equalizer?.getBandLevel(band.toShort()) ?: 0

    fun setBandLevel(band: Int, level: Short) {
        equalizer?.setBandLevel(band.toShort(), level)
    }

    fun setBassBoost(strength: Short) {
        bassBoost?.setStrength(strength)
    }

    fun setVirtualizer(strength: Short) {
        virtualizer?.setStrength(strength)
    }

    fun setCompressor(gainMb: Int) {
        if (gainMb > 0) {
            loudness?.setTargetGain(gainMb)
            loudness?.enabled = true
        } else {
            loudness?.enabled = false
        }
    }

    fun applyPreset(preset: EqPreset) {
        preset.bands.forEachIndexed { i, level ->
            if (i < bandCount) equalizer?.setBandLevel(i.toShort(), level)
        }
    }

    fun release() {
        equalizer?.release()
        bassBoost?.release()
        virtualizer?.release()
        loudness?.release()
    }
}
