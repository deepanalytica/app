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
        else Snackbar.make(
            recyclerView,
            "Permiso denegado. Toca Ajustes para concederlo.",
            Snackbar.LENGTH_LONG
        ).setAction("Ajustes") { openAppSettings() }.show()
    }

    private val manageStorageLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        // El usuario volvio de ajustes; re-escanear con el nuevo permiso
        startScan()
    }

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
        fabRecover.setOnClickListener { recoverSelected() }
        buttonAllFiles.setOnClickListener { requestManageStoragePermission() }

        // Mostrar boton MIUI solo si hace falta
        updateManageStorageButton()
        observeViewModel()
    }

    override fun onResume() {
        super.onResume()
        updateManageStorageButton()
    }

    private fun updateManageStorageButton() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            buttonAllFiles.visibility =
                if (Environment.isExternalStorageManager()) View.GONE else View.VISIBLE
        } else {
            buttonAllFiles.visibility = View.GONE
        }
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
        }
        viewModel.statusMessage.observe(this) { msg -> textStatus.text = msg }
        viewModel.pendingIntentSender.observe(this) { sender ->
            sender?.let { recoveryLauncher.launch(IntentSenderRequest.Builder(it).build()) }
        }
    }

    private fun checkPermissionsAndScan() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            Toast.makeText(this, "Requiere Android 11 o superior", Toast.LENGTH_LONG).show()
            return
        }
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
        viewModel.scanDeletedMedia(hasManage)
        updateManageStorageButton()
    }

    private fun requestManageStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Snackbar.make(
                recyclerView,
                "Activa \"Permitir acceso a todos los archivos\" para buscar en la papelera de MIUI",
                Snackbar.LENGTH_LONG
            ).setAction("Activar") {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.fromParts("package", packageName, null)
                }
                manageStorageLauncher.launch(intent)
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
        if (count > 0) {
            fabRecover.show()
            textSelectedCount.visibility = View.VISIBLE
            textSelectedCount.text = "$count archivo(s) seleccionado(s)"
        } else {
            fabRecover.hide()
            textSelectedCount.visibility = View.GONE
        }
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
