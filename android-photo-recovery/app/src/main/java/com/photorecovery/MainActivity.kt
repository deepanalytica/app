package com.photorecovery

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.Menu
import android.view.MenuItem
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.android.material.snackbar.Snackbar

class MainActivity : AppCompatActivity() {

    private val viewModel: RecoveryViewModel by viewModels()
    private lateinit var adapter: PhotoAdapter
    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var textStatus: TextView
    private lateinit var textSelectedCount: TextView
    private lateinit var layoutEmpty: View
    private lateinit var fabRecover: FloatingActionButton
    private lateinit var buttonScan: Button
    private lateinit var buttonAllFiles: Button

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->
        if (grants.values.all { it }) startScan()
        else Snackbar.make(recyclerView, "Permiso denegado", Snackbar.LENGTH_LONG)
            .setAction("Ajustes") { openAppSettings() }.show()
    }

    private val manageStorageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { startScan() }

    private val recoveryLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult()
    ) { result ->
        viewModel.onRecoveryResult(result.resultCode == Activity.RESULT_OK)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        setSupportActionBar(findViewById<Toolbar>(R.id.toolbar))

        recyclerView = findViewById(R.id.recyclerView)
        progressBar = findViewById(R.id.progressBar)
        textStatus = findViewById(R.id.textStatus)
        textSelectedCount = findViewById(R.id.textSelectedCount)
        layoutEmpty = findViewById(R.id.layoutEmpty)
        fabRecover = findViewById(R.id.fabRecover)
        buttonScan = findViewById(R.id.buttonScan)
        buttonAllFiles = findViewById(R.id.buttonAllFiles)

        adapter = PhotoAdapter { count -> onSelectionChanged(count) }
        recyclerView.layoutManager = GridLayoutManager(this, 3)
        recyclerView.adapter = adapter

        buttonScan.setOnClickListener { checkPermissionsAndScan() }
        buttonAllFiles.setOnClickListener { requestManageStorage() }
        fabRecover.setOnClickListener { recoverSelected() }

        updateButtons()
        observeViewModel()
    }

    override fun onResume() {
        super.onResume()
        updateButtons()
    }

    private fun updateButtons() {
        buttonAllFiles.visibility =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && !Environment.isExternalStorageManager())
                View.VISIBLE else View.GONE
    }

    private fun observeViewModel() {
        viewModel.items.observe(this) { list ->
            adapter.setItems(list)
            layoutEmpty.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
            recyclerView.visibility = if (list.isEmpty()) View.GONE else View.VISIBLE
        }
        viewModel.isLoading.observe(this) { loading ->
            progressBar.visibility = if (loading) View.VISIBLE else View.GONE
            buttonScan.isEnabled = !loading
            buttonAllFiles.isEnabled = !loading
        }
        viewModel.statusMessage.observe(this) { textStatus.text = it }
        viewModel.pendingIntentSender.observe(this) { sender ->
            sender?.let { recoveryLauncher.launch(IntentSenderRequest.Builder(it).build()) }
        }
    }

    private fun checkPermissionsAndScan() {
        val required = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU)
            arrayOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO)
        else
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        val allGranted = required.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
        if (allGranted) startScan() else permissionLauncher.launch(required)
    }

    private fun startScan() {
        val hasManage = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                Environment.isExternalStorageManager()
        viewModel.scanEverything(hasManage)
        updateButtons()
    }

    private fun requestManageStorage() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Snackbar.make(
                recyclerView,
                "Activa \"Permitir acceso a todos los archivos\" para ver WhatsApp, Telegram y mas",
                Snackbar.LENGTH_LONG
            ).setAction("Activar") {
                manageStorageLauncher.launch(
                    Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                        data = Uri.fromParts("package", packageName, null)
                    }
                )
            }.show()
        }
    }

    private fun recoverSelected() {
        val selected = adapter.getSelected()
        if (selected.isEmpty()) {
            Toast.makeText(this, "Selecciona al menos un archivo", Toast.LENGTH_SHORT).show()
            return
        }
        viewModel.recoverSelected(selected)
    }

    private fun onSelectionChanged(count: Int) {
        fabRecover.visibility = if (count > 0) View.VISIBLE else View.GONE
        textSelectedCount.visibility = if (count > 0) View.VISIBLE else View.GONE
        if (count > 0) textSelectedCount.text = "$count archivo(s) — toca el botón azul para guardar en DCIM/Recuperadas"
    }

    private fun openAppSettings() {
        startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", packageName, null)
        })
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem) = when (item.itemId) {
        R.id.action_select_all -> { adapter.selectAll(); true }
        R.id.action_clear -> { adapter.clearSelection(); true }
        else -> super.onOptionsItemSelected(item)
    }
}
