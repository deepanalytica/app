package com.photorecovery

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide

class PhotoAdapter(
    private val onSelectionChanged: (Int) -> Unit
) : RecyclerView.Adapter<PhotoAdapter.ViewHolder>() {

    private val items = mutableListOf<PhotoItem>()
    private var selectionMode = false

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val image: ImageView = view.findViewById(R.id.imagePhoto)
        val checkbox: CheckBox = view.findViewById(R.id.checkSelected)
        val overlay: View = view.findViewById(R.id.selectedOverlay)
        val name: TextView = view.findViewById(R.id.textName)
        val playIcon: ImageView = view.findViewById(R.id.iconPlay)
        val sourceTag: TextView = view.findViewById(R.id.textSource)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) =
        ViewHolder(LayoutInflater.from(parent.context).inflate(R.layout.item_photo, parent, false))

    override fun getItemCount() = items.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]

        Glide.with(holder.image)
            .load(item.uri)
            .centerCrop()
            .placeholder(R.drawable.ic_photo_placeholder)
            .error(R.drawable.ic_photo_placeholder)
            .into(holder.image)

        holder.name.text = item.displayName
        holder.checkbox.isChecked = item.isSelected
        holder.checkbox.visibility = if (selectionMode) View.VISIBLE else View.GONE
        holder.overlay.visibility = if (item.isSelected) View.VISIBLE else View.GONE
        holder.playIcon.visibility = if (item.isVideo) View.VISIBLE else View.GONE

        if (item.sourceName.isNotEmpty()) {
            holder.sourceTag.text = item.sourceName
            holder.sourceTag.visibility = View.VISIBLE
        } else {
            holder.sourceTag.visibility = View.GONE
        }

        holder.itemView.setOnLongClickListener {
            if (!selectionMode) {
                selectionMode = true
                notifyDataSetChanged()
            }
            toggleItem(item)
            true
        }
        holder.itemView.setOnClickListener {
            if (selectionMode) toggleItem(item)
        }
    }

    private fun toggleItem(item: PhotoItem) {
        item.isSelected = !item.isSelected
        notifyItemChanged(items.indexOf(item))
        val count = getSelectedCount()
        if (count == 0) { selectionMode = false; notifyDataSetChanged() }
        onSelectionChanged(count)
    }

    fun setItems(newItems: List<PhotoItem>) {
        items.clear()
        items.addAll(newItems)
        selectionMode = false
        notifyDataSetChanged()
        onSelectionChanged(0)
    }

    fun getSelected(): List<PhotoItem> = items.filter { it.isSelected }
    fun getSelectedCount() = items.count { it.isSelected }

    fun selectAll() {
        items.forEach { it.isSelected = true }
        selectionMode = true
        notifyDataSetChanged()
        onSelectionChanged(items.size)
    }

    fun clearSelection() {
        items.forEach { it.isSelected = false }
        selectionMode = false
        notifyDataSetChanged()
        onSelectionChanged(0)
    }
}
