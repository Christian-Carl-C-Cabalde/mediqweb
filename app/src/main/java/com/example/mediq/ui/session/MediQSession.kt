package com.example.mediq.ui.session

import android.content.Context
import android.content.SharedPreferences
import com.example.mediq.data.api.SupabaseClient
import java.io.File
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The account that is signed in.
 *
 * Only what the screens show: the name they greet, and the contact details
 * they list.
 */
data class SignedInUser(
    val username: String,
    val fullName: String,
    val email: String? = null,
    val phoneNumber: String? = null
)

/**
 * Who is signed in, and which accounts this device knows about.
 *
 * The screens used to print one fixed patient name, so anybody who signed in
 * still saw that same name on the home header and on the profile. Identity now
 * lives here: the auth screens record the account, and the screens read it
 * back.
 *
 * The signed-in account (and its tokens) are persisted to SharedPreferences so
 * closing and reopening the app does not sign the patient out.
 */
object MediQSession {

    private const val PREFS_NAME = "mediq_session"

    private const val KEY_ACCESS_TOKEN = "access_token"
    private const val KEY_REFRESH_TOKEN = "refresh_token"

    private var prefs: SharedPreferences? = null
    private var filesDir: File? = null

    private val _user = MutableStateFlow<SignedInUser?>(null)

    /** The account that is signed in, or null when nobody is. */
    val user: StateFlow<SignedInUser?> = _user.asStateFlow()

    /** The bearer token from the last sign-in, persisted to SharedPreferences. */
    val accessToken: String? get() = prefs?.getString(KEY_ACCESS_TOKEN, null) ?: SupabaseClient.accessToken

    /** The refresh token from the last sign-in, persisted to SharedPreferences. */
    val refreshToken: String? get() = prefs?.getString(KEY_REFRESH_TOKEN, null) ?: SupabaseClient.refreshToken

    /**
     * Accounts created on this device, keyed by username.
     *
     * A registration on this device is the only step that asks for a full
     * name, so it is kept here to answer the next sign-in.
     */
    private val knownAccounts = mutableMapOf<String, SignedInUser>()

    /** The details step's pending registration, waiting for the username. */
    internal data class RegistrationPending(
        val fullName: String,
        val email: String,
        val phoneNumber: String?,
    )

    /**
     * The name and number from the registration details step, waiting for the
     * username from the credentials step.
     */
    private var pendingRegistration: RegistrationPending? = null

    /** Bind this session to a context and restore any persisted account. */
    fun init(context: Context) {
        val app = context.applicationContext
        prefs = app.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        filesDir = app.filesDir
        restore()
    }

    /** Restore the persisted account into memory. Safe to call repeatedly. */
    fun restore(context: Context? = null) {
        context?.let {
            prefs = it.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
        val p = prefs
        var username = p?.getString("username", null)
        var fullName = p?.getString("fullName", null)
        var email = p?.getString("email", null)
        var phone = p?.getString("phone", null)

        // Restore tokens into the Supabase client so authenticated calls work
        // after a process death or app restart.
        val restoredAccess = p?.getString(KEY_ACCESS_TOKEN, null)
        val restoredRefresh = p?.getString(KEY_REFRESH_TOKEN, null)
        if (restoredAccess != null) SupabaseClient.accessToken = restoredAccess
        if (restoredRefresh != null) SupabaseClient.refreshToken = restoredRefresh

        // Fall back to the on-disk copy if SharedPreferences came up empty
        // (e.g. after a process death that did not flush prefs in time).
        if (username.isNullOrBlank()) {
            val file = filesDir?.let { File(it, "session.txt") }
            if (file != null && file.exists()) {
                val lines = file.readLines()
                fun get(key: String): String? =
                    lines.firstOrNull { it.startsWith("$key=") }?.substringAfter("=")?.ifBlank { null }
                username = get("username")
                fullName = get("fullName")
                email = get("email")
                phone = get("phone")
            }
        }
        if (username.isNullOrBlank()) return
        val resolvedFullName = fullName?.ifBlank { null } ?: username
        val resolvedEmail = email?.ifBlank { null }
        val resolvedPhone = phone?.ifBlank { null }
        val user = SignedInUser(username, resolvedFullName, resolvedEmail, resolvedPhone)
        knownAccounts[username] = user
        _user.value = user
    }

    /**
     * Remembers the details step, which is the only step that learns a
     * patient's real name, email, and optional number.
     */
    fun beginRegistration(fullName: String, email: String, phoneNumber: String) {
        pendingRegistration = RegistrationPending(
            fullName = fullName.trim(),
            email = email.trim(),
            phoneNumber = phoneNumber.trim().ifEmpty { null }
        )
    }

    /**
     * Takes and clears the pending registration, if any.
     */
    internal fun takePendingRegistration(): RegistrationPending? {
        val pending = pendingRegistration
        pendingRegistration = null
        return pending
    }

    /**
     * Creates the account now that the username is known.
     *
     * The account is not signed in yet: registration ends by sending the
     * patient to the sign-in screen.
     */
    fun completeRegistration(username: String) {
        val pending = pendingRegistration ?: RegistrationPending("", "", null)
        rememberAccount(username, pending.fullName, pending.email, pending.phoneNumber)
        pendingRegistration = null
    }

    /**
     * Records an account created on this device.
     *
     * Called by the registration flow, the only step that learns a patient's
     * real name and contact details.
     */
    fun rememberAccount(username: String, fullName: String, email: String, phoneNumber: String?) {
        val key = username.trim()
        if (key.isEmpty()) return

        knownAccounts[key] = SignedInUser(
            username = key,
            fullName = fullName.trim().ifEmpty { DisplayName.fromUsername(key) },
            email = email.ifBlank { null },
            phoneNumber = phoneNumber?.trim()?.ifEmpty { null }
        )
    }

    /**
     * Signs an account in.
     *
     * The real name is used when this device knows the account. Otherwise the
     * name is derived from the username, so the screen shows the account that
     * is actually signed in rather than a fixed sample.
     */
    fun signIn(username: String) {
        val key = username.trim()
        if (key.isEmpty()) return

        val user = knownAccounts[key] ?: SignedInUser(
            username = key,
            fullName = DisplayName.fromUsername(key)
        )
        knownAccounts[key] = user
        _user.value = user
        persistUser(user)
    }

    /**
     * Signs an account in from what the server answered.
     *
     * The server knows the patient's real name and contact details, so it
     * always wins over anything this device guessed.
     */
    fun signIn(user: SignedInUser) {
        if (user.username.isBlank()) return

        knownAccounts[user.username] = user
        _user.value = user
        persistUser(user)
    }

    /** Store the tokens issued at sign-in. */
    fun setTokens(accessToken: String?, refreshToken: String?) {
        SupabaseClient.accessToken = accessToken
        SupabaseClient.refreshToken = refreshToken
        val editor = prefs?.edit() ?: return
        accessToken?.let { editor.putString(KEY_ACCESS_TOKEN, it) } ?: editor.remove(KEY_ACCESS_TOKEN)
        refreshToken?.let { editor.putString(KEY_REFRESH_TOKEN, it) } ?: editor.remove(KEY_REFRESH_TOKEN)
        editor.commit()
    }

    /** Forgets the signed-in account. */
    fun signOut() {
        _user.value = null
        SupabaseClient.accessToken = null
        SupabaseClient.refreshToken = null
        persistClear()
    }

    /** Forgets everything. For tests. */
    internal fun reset() {
        _user.value = null
        knownAccounts.clear()
        pendingRegistration = null
        SupabaseClient.accessToken = null
        SupabaseClient.refreshToken = null
        persistClear()
    }

    private fun persistUser(user: SignedInUser?) {
        val editor = prefs?.edit() ?: return
        if (user == null) {
            editor.remove("username")
            editor.remove("fullName")
            editor.remove("email")
            editor.remove("phone")
        } else {
            editor.putString("username", user.username)
            editor.putString("fullName", user.fullName)
            editor.putString("email", user.email)
            editor.putString("phone", user.phoneNumber)
        }
        editor.commit()
        persistFile()
    }

    private fun persistTokens() {
        // Supabase client manages its own token persistence; nothing to store here.
    }

    private fun persistClear() {
        prefs?.edit()?.clear()?.commit()
        filesDir?.let { File(it, "session.txt").delete() }
    }

    private fun persistFile() {
        val file = filesDir?.let { File(it, "session.txt") } ?: return
        val user = _user.value
        if (user == null) {
            file.delete()
            return
        }
        file.writeText(
            "username=${user.username}\n" +
                "fullName=${user.fullName}\n" +
                "email=${user.email ?: ""}\n" +
                "phone=${user.phoneNumber ?: ""}\n"
        )
    }
}