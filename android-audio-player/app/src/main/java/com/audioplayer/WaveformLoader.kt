package com.audioplayer

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.sqrt

object WaveformLoader {

    suspend fun load(context: Context, uri: Uri, barCount: Int = 150): Pair<FloatArray, Long> =
        withContext(Dispatchers.IO) {
            val extractor = MediaExtractor()
            try {
                extractor.setDataSource(context, uri, null)

                val trackIndex = (0 until extractor.trackCount).firstOrNull { i ->
                    extractor.getTrackFormat(i)
                        .getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
                } ?: return@withContext Pair(placeholder(barCount), 0L)

                val format    = extractor.getTrackFormat(trackIndex)
                val durationUs = runCatching { format.getLong(MediaFormat.KEY_DURATION) }.getOrDefault(0L)
                val durationMs = durationUs / 1000
                if (durationMs == 0L) return@withContext Pair(placeholder(barCount), 0L)

                extractor.selectTrack(trackIndex)

                val mime    = format.getString(MediaFormat.KEY_MIME) ?: return@withContext Pair(placeholder(barCount), durationMs)
                val decoder = MediaCodec.createDecoderByType(mime)
                decoder.configure(format, null, null, 0)
                decoder.start()

                val amplitudes  = FloatArray(barCount)
                val barCounts   = IntArray(barCount)
                val usPerBar    = durationUs.toFloat() / barCount
                var inputEos    = false
                var outputEos   = false
                val info        = MediaCodec.BufferInfo()

                while (!outputEos) {
                    if (!inputEos) {
                        val idx = decoder.dequeueInputBuffer(0)
                        if (idx >= 0) {
                            val buf  = decoder.getInputBuffer(idx)!!
                            val size = extractor.readSampleData(buf, 0)
                            if (size < 0) {
                                decoder.queueInputBuffer(idx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                                inputEos = true
                            } else {
                                decoder.queueInputBuffer(idx, 0, size, extractor.sampleTime, 0)
                                extractor.advance()
                            }
                        }
                    }

                    val outIdx = decoder.dequeueOutputBuffer(info, 0)
                    when {
                        outIdx >= 0 -> {
                            val outBuf = decoder.getOutputBuffer(outIdx)
                            if (outBuf != null && info.size > 0) {
                                val bar = (info.presentationTimeUs / usPerBar).toInt().coerceIn(0, barCount - 1)
                                val shorts = outBuf.asShortBuffer()
                                var sum = 0.0
                                var n   = 0
                                while (shorts.hasRemaining()) {
                                    val s = shorts.get().toDouble() / 32768.0
                                    sum += s * s
                                    n++
                                }
                                if (n > 0) {
                                    amplitudes[bar] += sqrt(sum / n).toFloat()
                                    barCounts[bar]++
                                }
                            }
                            decoder.releaseOutputBuffer(outIdx, false)
                            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputEos = true
                        }
                        outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> { /* continue */ }
                    }
                }

                runCatching { decoder.stop(); decoder.release() }

                // Average accumulated values
                for (i in amplitudes.indices) {
                    if (barCounts[i] > 0) amplitudes[i] /= barCounts[i]
                }

                // Normalize to [0.05, 1.0]
                val maxAmp = amplitudes.maxOrNull()?.coerceAtLeast(0.01f) ?: 0.01f
                for (i in amplitudes.indices) {
                    amplitudes[i] = (amplitudes[i] / maxAmp).coerceIn(0.05f, 1f)
                }

                Pair(amplitudes, durationMs)
            } catch (e: Exception) {
                Pair(placeholder(barCount), 0L)
            } finally {
                runCatching { extractor.release() }
            }
        }

    private fun placeholder(count: Int) = FloatArray(count) { 0.3f }
}
