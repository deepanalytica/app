package com.photorecovery

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class EventAdapter : RecyclerView.Adapter<EventAdapter.ViewHolder>() {

    private val events = mutableListOf<EventItem>()
    private val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val dot: View = view.findViewById(R.id.dot)
        val time: TextView = view.findViewById(R.id.textTime)
        val title: TextView = view.findViewById(R.id.textTitle)
        val detail: TextView = view.findViewById(R.id.textDetail)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_event, parent, false))

    override fun getItemCount() = events.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val e = events[position]
        holder.time.text = timeFmt.format(Date(e.timestamp))
        holder.title.text = e.title
        holder.detail.text = e.detail
        holder.detail.visibility = if (e.detail.isNotEmpty()) View.VISIBLE else View.GONE

        val color = when (e.category) {
            "sent"       -> 0xFFD32F2F.toInt()   // rojo — archivo enviado
            "screenshot" -> 0xFFE65100.toInt()   // naranja — captura
            "photo"      -> 0xFF1565C0.toInt()   // azul — foto nueva
            "screen"     -> 0xFF388E3C.toInt()   // verde — pantalla encendida
            "app"        -> 0xFF6A1B9A.toInt()   // morado — app abierta
            else         -> 0xFF757575.toInt()
        }
        holder.dot.setBackgroundColor(color)
    }

    fun setEvents(list: List<EventItem>) {
        events.clear()
        events.addAll(list)
        notifyDataSetChanged()
    }
}
