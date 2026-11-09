package com.example.mediq.data.api

import com.example.mediq.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit

object SupabaseClient {
    /*
     * Supabase project connection details.
     *
     * Debug builds: local Supabase (port 54321 via Docker). Change DEBUG_URL to match
     * your dev machine (emulator uses 10.0.2.2).
     *
     * Release builds: the remote Supabase project.
     *
     * Override with -Dmediq.supabase.url=... and -Dmediq.supabase.anonKey=... if needed.
     */
    private const val DEBUG_URL = "https://wdoyhtjpjhmhsegdllvd.supabase.co"
    private const val DEBUG_ANON_KEY = "sb_publishable_dqZ7_WytRZV-VszwpoPbSg_ACWypKl8"

    private val SUPABASE_URL: String =
        System.getProperty("mediq.supabase.url") ?: if (BuildConfig.DEBUG) {
            DEBUG_URL
        } else {
            "https://wdoyhtjpjhmhsegdllvd.supabase.co"
        }

    private val SUPABASE_ANON_KEY: String =
        System.getProperty("mediq.supabase.anonKey") ?: DEBUG_ANON_KEY

    /** The OkHttp client configured for Supabase REST API calls. */
    val client: OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY })
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    /** Base REST path for Supabase. */
    val restUrl: String = "$SUPABASE_URL/rest/v1"

    /** Auth base path. */
    val authUrl: String = "$SUPABASE_URL/auth/v1"

    /** The anon key used for unauthenticated requests. */
    val anonKey: String = SUPABASE_ANON_KEY

    /** The bearer token from the last sign-in. */
    @Volatile
    var accessToken: String? = null

    /** The refresh token from the last sign-in. */
    @Volatile
    var refreshToken: String? = null
}
