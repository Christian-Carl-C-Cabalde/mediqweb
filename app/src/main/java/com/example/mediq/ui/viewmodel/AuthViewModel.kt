package com.example.mediq.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.mediq.data.api.SupabaseApiService
import com.example.mediq.data.api.SupabaseClient
import com.example.mediq.data.model.*
import com.example.mediq.ui.session.MediQSession
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel : ViewModel() {
    private val api = SupabaseApiService()

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    private var currentUser: UserProfile? = null

    /**
     * Checks a pair with Supabase Auth.
     *
     * Returns the account it authenticated, or null when it did not — the
     * reason is left in [uiState] for the screen to say.
     */
    suspend fun signIn(username: String, password: String): UserProfile? {
        _uiState.value = AuthUiState.Loading
        return try {
            val session = api.signIn(SignInRequest(username, password))
            currentUser = session.profile
            MediQSession.setTokens(session.accessToken, session.refreshToken)
            _uiState.value = AuthUiState.Success(session.profile)
            session.profile
        } catch (e: Exception) {
            _uiState.value = if (e.message?.contains("401") == true || e.message?.contains("Invalid credentials") == true) {
                AuthUiState.InvalidCredentials
            } else {
                AuthUiState.Error("We could not reach MediQ. Check your connection and try again.")
            }
            null
        }
    }

    fun register(request: RegisterRequest) {
        viewModelScope.launch {
            _uiState.value = AuthUiState.Loading
            try {
                val session = api.register(request)
                currentUser = session.profile
                MediQSession.setTokens(session.accessToken, session.refreshToken)
                _uiState.value = AuthUiState.Success(session.profile)
            } catch (e: Exception) {
                _uiState.value = AuthUiState.Error(registerMessage(e))
            }
        }
    }

    /**
     * Asks the server to send a one-time code to a contact.
     *
     * Returns true when the code went out. The code itself is on the server,
     * which has no SMS gateway behind it yet.
     */
    suspend fun requestOtp(contact: String, purpose: OtpPurpose): Boolean = try {
        api.requestOtp(RequestOtpRequest(contact = contact.trim(), purpose = purpose))
        true
    } catch (e: Exception) {
        _uiState.value = AuthUiState.Error(e.message ?: "We could not send the code.")
        false
    }

    /**
     * Checks a one-time code.
     *
     * Returns the session the server issued when the code was right, or null
     * when it was not — the reason is left in [uiState].
     */
    suspend fun verifyOtp(contact: String, code: String, purpose: OtpPurpose): AuthSession? = try {
        val session = api.verifyOtp(
            VerifyOtpRequest(contact = contact.trim(), code = code.trim(), purpose = purpose)
        )
        _uiState.value = AuthUiState.Success(session.profile)
        session
    } catch (e: Exception) {
        _uiState.value = AuthUiState.Error(e.message ?: "We could not check the code.")
        null
    }

    /**
     * Sets a new password for the account the code proved.
     */
    suspend fun updatePassword(newPassword: String): Boolean = try {
        api.updatePassword(UpdatePasswordRequest(newPassword = newPassword))
        true
    } catch (e: Exception) {
        _uiState.value = AuthUiState.Error(e.message ?: "We could not save your new password.")
        false
    }

    /**
     * What the server said about a rejected registration.
     */
    private fun registerMessage(e: Exception): String {
        return when {
            e.message?.contains("already in use") == true -> "That email is already in use. Choose another one."
            else -> "Registration failed. Check your details and try again."
        }
    }

    fun getAccessToken(): String? = SupabaseClient.accessToken

    fun getCurrentUser(): UserProfile? = currentUser
}

sealed class AuthUiState {
    object Idle : AuthUiState()
    object Loading : AuthUiState()
    object InvalidCredentials : AuthUiState()
    data class Success(val profile: UserProfile) : AuthUiState()
    data class Error(val message: String) : AuthUiState()
}
