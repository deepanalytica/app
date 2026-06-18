package com.securityguard

import android.Manifest
import android.app.AppOpsManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.securityguard.databinding.ActivityMainBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val adapter = AlertAdapter()
    private var isMonitorRunning = false

    private val alertReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val title   = intent.getStringExtra(MonitorService.EXTRA_TITLE)  ?: return
            val detail  = intent.getStringExtra(MonitorService.EXTRA_DETAIL) ?: ""
            val catName = intent.getStringExtra(MonitorService.EXTRA_CAT)    ?: ""
            val pkg     = intent.getStringExtra(MonitorService.EXTRA_PACKAGE)

            val alert = SecurityAlert(
                title       = title,
                detail      = detail,
                severity    = Severity.HIGH,
                category    = runCatching { Category.valueOf(catName) }.getOrDefault(Category.SYSTEM),
                packageName = pkg
            )
            adapter.add(alert)
            updateScore()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupRecyclerView()
        setupButtons()
        checkPermissionsAndStart()
    }

    override fun onResume() {
        super.onResume()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(alertReceiver, IntentFilter(MonitorService.ACTION_NEW_ALERT),
                Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(alertReceiver, IntentFilter(MonitorService.ACTION_NEW_ALERT))
        }
        updatePermissionBadges()
    }

    override fun onPause() {
        super.onPause()
        try { unregisterReceiver(alertReceiver) } catch (e: Exception) { /* not registered */ }
    }

    // ── Setup ─────────────────────────────────────────────────────────────────

    private fun setupRecyclerView() {
        binding.rvAlerts.layoutManager = LinearLayoutManager(this)
        binding.rvAlerts.adapter = adapter
    }

    private fun setupButtons() {
        binding.btnScan.setOnClickListener { runScan() }
        binding.btnCallForward.setOnClickListener { showCallForwardingDialog() }
        binding.btnAuditApps.setOnClickListener {
            startActivity(Intent(this, PermissionsAuditActivity::class.java))
        }
        binding.btnGrantUsage.setOnClickListener {
            startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
        }
        binding.btnGrantPhone.setOnClickListener {
            requestPermissions(arrayOf(Manifest.permission.CALL_PHONE), REQ_CALL)
        }
    }

    // ── Permissions ───────────────────────────────────────────────────────────

    private fun checkPermissionsAndStart() {
        updatePermissionBadges()
        if (hasUsageStats()) {
            startMonitorService()
            runScan()
        }
    }

    private fun hasUsageStats(): Boolean {
        val appOps = getSystemService(APP_OPS_SERVICE) as AppOpsManager
        val mode   = appOps.unsafeCheckOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun updatePermissionBadges() {
        val hasUsage = hasUsageStats()
        val hasCall  = ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED

        binding.badgeUsage.text = if (hasUsage) "Uso de apps: ACTIVO" else "Uso de apps: REQUERIDO"
        binding.badgeCall.text  = if (hasCall)  "Telefono: ACTIVO"    else "Telefono: necesario para desvio"
        binding.btnGrantUsage.visibility = if (hasUsage) View.GONE else View.VISIBLE
        binding.btnGrantPhone.visibility = if (hasCall)  View.GONE else View.VISIBLE

        if (hasUsage && !isMonitorRunning) {
            startMonitorService()
        }
        updateScore()
    }

    private fun startMonitorService() {
        isMonitorRunning = true
        ContextCompat.startForegroundService(this, Intent(this, MonitorService::class.java))
        binding.tvMonitorStatus.text = "Monitor activo"
        binding.tvMonitorStatus.setTextColor(0xFF4CAF50.toInt())
    }

    // ── Scan ──────────────────────────────────────────────────────────────────

    private fun runScan() {
        binding.btnScan.isEnabled = false
        binding.progressScan.visibility = View.VISIBLE

        lifecycleScope.launch {
            val alerts = withContext(Dispatchers.IO) {
                SecurityScanner.runFullScan(this@MainActivity)
            }
            adapter.setAll(alerts)
            binding.progressScan.visibility = View.GONE
            binding.btnScan.isEnabled = true
            updateScore()
        }
    }

    private fun updateScore() {
        val alerts = adapter.items
        val score  = calculateScore(alerts)
        binding.tvScore.text = score.toString()
        binding.tvScore.setTextColor(when {
            score >= 80 -> 0xFF4CAF50.toInt()
            score >= 50 -> 0xFFFF9800.toInt()
            else        -> 0xFFF44336.toInt()
        })
        binding.tvScoreLabel.text = when {
            score >= 80 -> "Seguro"
            score >= 50 -> "Riesgo moderado"
            else        -> "En riesgo"
        }
    }

    private fun calculateScore(alerts: List<SecurityAlert>): Int {
        var score = 100
        for (a in alerts) {
            score -= when (a.severity) {
                Severity.CRITICAL -> 30
                Severity.HIGH     -> 15
                Severity.MEDIUM   -> 8
                Severity.LOW      -> 3
                Severity.INFO     -> 0
            }
        }
        return score.coerceIn(0, 100)
    }

    // ── Call Forwarding Dialog ────────────────────────────────────────────────

    private fun showCallForwardingDialog() {
        val hasCall = ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
        if (!hasCall) {
            Toast.makeText(this, "Se necesita permiso de teléfono para verificar desvíos", Toast.LENGTH_LONG).show()
            requestPermissions(arrayOf(Manifest.permission.CALL_PHONE), REQ_CALL)
            return
        }

        val options = arrayOf(
            "Verificar desvío total (*#21#)",
            "Verificar cuando ocupado (*#67#)",
            "Verificar sin respuesta (*#61#)",
            "Verificar sin cobertura (*#62#)",
            "─────────────────────────",
            "CANCELAR TODOS los desvíos (##002#)"
        )

        AlertDialog.Builder(this, R.style.DarkDialog)
            .setTitle("Desvío de llamadas")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> checkForwarding("*#21#")
                    1 -> checkForwarding("*#67#")
                    2 -> checkForwarding("*#61#")
                    3 -> checkForwarding("*#62#")
                    5 -> disableAllForwarding()
                }
            }
            .show()
    }

    private fun checkForwarding(code: String) {
        Toast.makeText(this, "Enviando consulta USSD...", Toast.LENGTH_SHORT).show()
        CallForwardingManager.checkForwarding(this, code) { result ->
            runOnUiThread {
                val msg = if (result.error) {
                    "Error: ${result.response ?: "sin respuesta"}"
                } else {
                    val status = if (result.isActive) "ACTIVO" else "No activo"
                    "${result.description}: $status\n\nRespuesta: ${result.response}"
                }

                val builder = AlertDialog.Builder(this, R.style.DarkDialog)
                    .setTitle("Resultado desvío")
                    .setMessage(msg)
                    .setPositiveButton("OK", null)

                if (result.isActive) {
                    builder.setNegativeButton("Cancelar este desvío") { _, _ -> disableAllForwarding() }
                }
                builder.show()

                if (result.isActive) {
                    adapter.add(SecurityAlert(
                        title    = "Desvio de llamadas activo",
                        detail   = "${result.description}: ${result.response}",
                        severity = Severity.CRITICAL,
                        category = Category.CALL
                    ))
                    updateScore()
                }
            }
        }
    }

    private fun disableAllForwarding() {
        Toast.makeText(this, "Cancelando todos los desvíos...", Toast.LENGTH_SHORT).show()
        CallForwardingManager.disableAllForwarding(this) { response ->
            runOnUiThread {
                Toast.makeText(this, "Respuesta: $response", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        updatePermissionBadges()
    }

    companion object {
        private const val REQ_CALL = 101
    }
}
