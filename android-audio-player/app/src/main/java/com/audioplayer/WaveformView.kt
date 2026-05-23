package com.audioplayer

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs

class WaveformView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null
) : View(context, attrs) {

    private var samples = FloatArray(0)
    private var selStart = 0f   // 0.0–1.0
    private var selEnd   = 1f   // 0.0–1.0
    var durationMs = 0L
    var onSelectionChanged: ((Long, Long) -> Unit)? = null

    private var dragging = -1  // 0=start handle, 1=end handle
    private val HANDLE_RADIUS = 48f

    private val paintBar     = Paint().apply { color = 0xFF5E35B1.toInt() }
    private val paintBarDim  = Paint().apply { color = 0xFF2D1B6B.toInt() }
    private val paintSel     = Paint().apply { color = 0x307C4DFF.toInt() }
    private val paintStart   = Paint().apply { color = 0xFF4CAF50.toInt(); strokeWidth = 4f }
    private val paintEnd     = Paint().apply { color = 0xFFF44336.toInt(); strokeWidth = 4f }
    private val paintHandle  = Paint().apply { style = Paint.Style.FILL }
    private val paintLoading = Paint().apply {
        color = 0xFF9E9E9E.toInt()
        textSize = 40f
        textAlign = Paint.Align.CENTER
    }

    fun setSamples(data: FloatArray, dur: Long) {
        samples = data
        durationMs = dur
        invalidate()
    }

    fun setSelection(startMs: Long, endMs: Long) {
        if (durationMs > 0) {
            selStart = startMs.toFloat() / durationMs
            selEnd   = endMs.toFloat()   / durationMs
            invalidate()
        }
    }

    fun getStartMs() = (selStart * durationMs).toLong()
    fun getEndMs()   = (selEnd   * durationMs).toLong()

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val mid = h / 2f

        canvas.drawColor(0xFF1A1A2E.toInt())

        if (samples.isEmpty()) {
            canvas.drawText("Cargando forma de onda…", w / 2, mid + 14, paintLoading)
            return
        }

        val barW = w / samples.size

        // Draw bars (no Paint allocation inside loop)
        for (i in samples.indices) {
            val x   = i * barW
            val amp = samples[i] * mid * 0.92f
            val pos = i.toFloat() / samples.size
            canvas.drawRect(x, mid - amp, x + barW - 1f, mid + amp,
                if (pos in selStart..selEnd) paintBar else paintBarDim)
        }

        // Draw selection overlay
        canvas.drawRect(selStart * w, 0f, selEnd * w, h, paintSel)

        val sx = selStart * w
        val ex = selEnd   * w

        // Start line + handle
        paintHandle.color = 0xFF4CAF50.toInt()
        canvas.drawRect(sx - 3f, 0f, sx + 3f, h, paintStart)
        canvas.drawCircle(sx, mid, 20f, paintHandle)

        // End line + handle
        paintHandle.color = 0xFFF44336.toInt()
        canvas.drawRect(ex - 3f, 0f, ex + 3f, h, paintEnd)
        canvas.drawCircle(ex, mid, 20f, paintHandle)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val x = event.x
        val w = width.toFloat()
        val sx = selStart * w
        val ex = selEnd   * w

        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                dragging = when {
                    abs(x - sx) < HANDLE_RADIUS -> 0
                    abs(x - ex) < HANDLE_RADIUS -> 1
                    else -> return false
                }
            }
            MotionEvent.ACTION_MOVE -> {
                if (dragging < 0) return false
                val pos = (x / w).coerceIn(0f, 1f)
                if (dragging == 0) selStart = pos.coerceAtMost(selEnd   - 0.005f)
                else               selEnd   = pos.coerceAtLeast(selStart + 0.005f)
                invalidate()
                onSelectionChanged?.invoke(getStartMs(), getEndMs())
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> dragging = -1
        }
        return true
    }
}
