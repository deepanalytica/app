package com.securityguard

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.securityguard.databinding.ItemAlertBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AlertAdapter(val items: MutableList<SecurityAlert> = mutableListOf()) :
    RecyclerView.Adapter<AlertAdapter.VH>() {

    inner class VH(val b: ItemAlertBinding) : RecyclerView.ViewHolder(b.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        VH(ItemAlertBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun getItemCount() = items.size

    override fun onBindViewHolder(holder: VH, position: Int) {
        val alert = items[position]
        with(holder.b) {
            tvTitle.text  = alert.title
            tvDetail.text = alert.detail
            tvTime.text   = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(alert.timestamp))
            tvSeverity.text = alert.severity.name
            tvSeverity.setBackgroundColor(alert.severity.color())
            viewSeverityBar.setBackgroundColor(alert.severity.color())
        }
    }

    fun add(alert: SecurityAlert) {
        items.add(0, alert)
        notifyItemInserted(0)
    }

    fun setAll(list: List<SecurityAlert>) {
        items.clear()
        items.addAll(list)
        notifyDataSetChanged()
    }
}
