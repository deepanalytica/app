package com.securityguard

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.securityguard.databinding.ActivityPermissionsAuditBinding
import com.securityguard.databinding.ItemAppPermissionBinding

data class AppPermInfo(
    val name: String, val pkg: String,
    val hasMic: Boolean, val hasCamera: Boolean, val hasLocation: Boolean,
    val hasContacts: Boolean, val hasSms: Boolean, val hasCallLog: Boolean,
    val isSystem: Boolean
)

class PermissionsAuditActivity : AppCompatActivity() {
    private lateinit var binding: ActivityPermissionsAuditBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPermissionsAuditBinding.inflate(layoutInflater)
        setContentView(binding.root)
        supportActionBar?.title = "Auditoría de permisos"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        val pm = packageManager
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA).map { info ->
            AppPermInfo(
                name        = pm.getApplicationLabel(info).toString(),
                pkg         = info.packageName,
                hasMic      = has(pm, info.packageName, android.Manifest.permission.RECORD_AUDIO),
                hasCamera   = has(pm, info.packageName, android.Manifest.permission.CAMERA),
                hasLocation = has(pm, info.packageName, android.Manifest.permission.ACCESS_FINE_LOCATION),
                hasContacts = has(pm, info.packageName, android.Manifest.permission.READ_CONTACTS),
                hasSms      = has(pm, info.packageName, android.Manifest.permission.READ_SMS),
                hasCallLog  = has(pm, info.packageName, android.Manifest.permission.READ_CALL_LOG),
                isSystem    = (info.flags and ApplicationInfo.FLAG_SYSTEM) != 0
            )
        }.filter { it.hasMic || it.hasCamera || it.hasLocation || it.hasContacts || it.hasSms || it.hasCallLog }
         .sortedWith(compareByDescending<AppPermInfo> { !it.isSystem }
             .thenByDescending { listOf(it.hasMic,it.hasCamera,it.hasLocation,it.hasContacts,it.hasSms,it.hasCallLog).count{b->b} })

        binding.rvApps.layoutManager = LinearLayoutManager(this)
        binding.rvApps.adapter = AppPermAdapter(apps)
        binding.tvCount.text = "${apps.count{!it.isSystem}} apps de usuario y ${apps.count{it.isSystem}} del sistema con permisos sensibles"
    }

    private fun has(pm: PackageManager, pkg: String, perm: String) =
        pm.checkPermission(perm, pkg) == PackageManager.PERMISSION_GRANTED

    override fun onSupportNavigateUp(): Boolean { onBackPressedDispatcher.onBackPressed(); return true }
}

class AppPermAdapter(private val items: List<AppPermInfo>) : RecyclerView.Adapter<AppPermAdapter.VH>() {
    inner class VH(val b: ItemAppPermissionBinding) : RecyclerView.ViewHolder(b.root)
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemAppPermissionBinding.inflate(LayoutInflater.from(parent.context), parent, false))
    override fun getItemCount() = items.size
    override fun onBindViewHolder(holder: VH, position: Int) {
        val a = items[position]
        with(holder.b) {
            tvAppName.text = a.name
            tvPkg.text = a.pkg
            tvPerms.text = buildString {
                if (a.hasMic) append("🎙 "); if (a.hasCamera) append("📷 ")
                if (a.hasLocation) append("📍 "); if (a.hasContacts) append("👤 ")
                if (a.hasSms) append("💬 "); if (a.hasCallLog) append("📞 ")
            }.trim()
            tvSystem.visibility = if (a.isSystem) View.VISIBLE else View.GONE
            val danger = listOf(a.hasMic,a.hasCamera,a.hasLocation,a.hasContacts,a.hasSms,a.hasCallLog).count{it}
            root.setBackgroundColor(when { !a.isSystem && danger>=4 -> 0x22F44336.toInt(); !a.isSystem && danger>=2 -> 0x22FF9800.toInt(); else -> 0 })
        }
    }
}
