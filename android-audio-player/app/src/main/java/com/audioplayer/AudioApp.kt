package com.audioplayer

import android.app.Application

class AudioApp : Application() {
    companion object {
        lateinit var instance: AudioApp
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}
