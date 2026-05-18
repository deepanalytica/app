package com.audioplayer

import android.os.Bundle
import android.widget.SeekBar
import androidx.appcompat.app.AppCompatActivity
import com.audioplayer.databinding.ActivityEqualizerBinding
import com.google.android.material.chip.Chip

class EqualizerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityEqualizerBinding
    private val eq get() = PlayerService.equalizerManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityEqualizerBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.title = "Ecualizador"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        setupPresetChips()
        setupBandSliders()
        setupEffectSliders()
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }

    private fun setupPresetChips() {
        EQ_PRESETS.forEach { preset ->
            val chip = Chip(this).apply {
                text = preset.name
                isCheckable = true
                setTextColor(getColor(R.color.white))
                setChipBackgroundColorResource(R.color.surface)
                setOnClickListener {
                    eq?.applyPreset(preset)
                    refreshBandSliders()
                    // visually mark selected chip
                    (binding.chipGroupPresets.parent as? android.view.View)?.invalidate()
                }
                setOnCheckedChangeListener { _, isChecked ->
                    setChipBackgroundColorResource(if (isChecked) R.color.primary else R.color.surface)
                }
            }
            binding.chipGroupPresets.addView(chip)
        }
    }

    private fun setupBandSliders() {
        val eqMgr = eq ?: return
        val bands = eqMgr.bandCount
        val range = eqMgr.bandLevelRange
        val min = range[0].toInt()
        val span = range[1].toInt() - min

        val seekbars = listOf(
            binding.seekBand1,
            binding.seekBand2,
            binding.seekBand3,
            binding.seekBand4,
            binding.seekBand5
        )
        val labels = listOf(
            binding.tvBand1Label,
            binding.tvBand2Label,
            binding.tvBand3Label,
            binding.tvBand4Label,
            binding.tvBand5Label
        )
        val values = listOf(
            binding.tvBand1Value,
            binding.tvBand2Value,
            binding.tvBand3Value,
            binding.tvBand4Value,
            binding.tvBand5Value
        )

        for (i in 0 until minOf(bands, 5)) {
            labels[i].text = eqMgr.getCenterFreqLabel(i)
            seekbars[i].max = span
            val currentLevel = eqMgr.getBandLevel(i).toInt()
            seekbars[i].progress = currentLevel - min
            values[i].text = "${currentLevel / 100} dB"
            val bandIndex = i
            seekbars[i].setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                    if (fromUser) {
                        val level = (progress + min).toShort()
                        eqMgr.setBandLevel(bandIndex, level)
                        values[bandIndex].text = "${level.toInt() / 100} dB"
                    }
                }
                override fun onStartTrackingTouch(sb: SeekBar) {}
                override fun onStopTrackingTouch(sb: SeekBar) {}
            })
        }
    }

    private fun refreshBandSliders() {
        val eqMgr = eq ?: return
        val range = eqMgr.bandLevelRange
        val min = range[0].toInt()

        val seekbars = listOf(binding.seekBand1, binding.seekBand2, binding.seekBand3, binding.seekBand4, binding.seekBand5)
        val values = listOf(binding.tvBand1Value, binding.tvBand2Value, binding.tvBand3Value, binding.tvBand4Value, binding.tvBand5Value)

        for (i in 0 until minOf(eqMgr.bandCount, 5)) {
            val level = eqMgr.getBandLevel(i).toInt()
            seekbars[i].progress = level - min
            values[i].text = "${level / 100} dB"
        }
    }

    private fun setupEffectSliders() {
        binding.seekBass.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                if (fromUser) eq?.setBassBoost(progress.toShort())
                binding.tvBassValue.text = "${progress / 10}"
            }
            override fun onStartTrackingTouch(sb: SeekBar) {}
            override fun onStopTrackingTouch(sb: SeekBar) {}
        })

        binding.seekVirtualizer.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                if (fromUser) eq?.setVirtualizer(progress.toShort())
                binding.tvVirtualizerValue.text = "${progress / 10}"
            }
            override fun onStartTrackingTouch(sb: SeekBar) {}
            override fun onStopTrackingTouch(sb: SeekBar) {}
        })

        binding.seekCompressor.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar, progress: Int, fromUser: Boolean) {
                if (fromUser) eq?.setCompressor(progress * 10)
                binding.tvCompressorValue.text = if (progress == 0) "OFF" else "+${progress}dB"
            }
            override fun onStartTrackingTouch(sb: SeekBar) {}
            override fun onStopTrackingTouch(sb: SeekBar) {}
        })
    }
}
