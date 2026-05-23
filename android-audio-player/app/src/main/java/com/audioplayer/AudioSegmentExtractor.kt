package com.audioplayer

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaMuxer
import android.media.MediaScannerConnection
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.nio.ByteBuffer

object AudioSegmentExtractor {

    suspend fun extract(
        context: Context,
        inputUri: Uri,
        startMs: Long,
        endMs: Long,
        outputFile: File,
        onProgress: (Int) -> Unit = {}
    ): Boolean = withContext(Dispatchers.IO) {
        val extractor = MediaExtractor()
        try {
            extractor.setDataSource(context, inputUri, null)

            val trackIndex = (0 until extractor.trackCount).firstOrNull { i ->
                extractor.getTrackFormat(i)
                    .getString(android.media.MediaFormat.KEY_MIME)?.startsWith("audio/") == true
            } ?: return@withContext false

            extractor.selectTrack(trackIndex)
            extractor.seekTo(startMs * 1000L, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)

            val format    = extractor.getTrackFormat(trackIndex)
            val muxer     = MediaMuxer(outputFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            val muxTrack  = muxer.addTrack(format)
            muxer.start()

            val buffer      = ByteBuffer.allocate(512 * 1024)
            val bufInfo     = MediaCodec.BufferInfo()
            val totalUs     = (endMs - startMs) * 1000L
            val startUs     = startMs * 1000L
            val endUs       = endMs   * 1000L

            while (true) {
                val size    = extractor.readSampleData(buffer, 0)
                if (size < 0) break
                val timeUs  = extractor.sampleTime
                if (timeUs > endUs) break
                if (timeUs < startUs) { extractor.advance(); continue }

                bufInfo.offset              = 0
                bufInfo.size                = size
                bufInfo.presentationTimeUs  = timeUs - startUs
                bufInfo.flags               = extractor.sampleFlags
                muxer.writeSampleData(muxTrack, buffer, bufInfo)

                val progress = ((timeUs - startUs).toFloat() / totalUs * 100).toInt()
                onProgress(progress.coerceIn(0, 99))
                extractor.advance()
            }

            onProgress(100)
            muxer.stop()
            muxer.release()

            MediaScannerConnection.scanFile(context, arrayOf(outputFile.absolutePath), arrayOf("audio/mp4"), null)
            true
        } catch (e: Exception) {
            outputFile.delete()
            false
        } finally {
            runCatching { extractor.release() }
        }
    }
}
