package com.example.mediq.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.mediq.data.api.SupabaseApiService
import com.example.mediq.data.model.Message
import com.example.mediq.data.model.MessageAuthorRole
import com.example.mediq.ui.screens.messages.ChatMessage
import com.example.mediq.ui.screens.secretarychat.ChatUiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ChatViewModel : ViewModel() {
    private val api = SupabaseApiService()

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun loadMessages(conversationId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val apiMessages = api.getMessages(conversationId)
                _messages.value = apiMessages.map { msg ->
                    ChatMessage(
                        text = msg.body,
                        sentByPatient = msg.authorRole == com.example.mediq.data.model.MessageAuthorRole.PATIENT,
                        time = msg.sentAt,
                    )
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load messages"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun sendMessage(conversationId: String, text: String) {
        viewModelScope.launch {
            _error.value = null
            try {
                val sent = api.sendMessage(conversationId, text)
                _messages.value = _messages.value + listOf(
                    ChatMessage(
                        text = sent.body,
                        sentByPatient = sent.authorRole == MessageAuthorRole.PATIENT,
                        time = sent.sentAt.toString(),
                    )
                )
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to send message"
            }
        }
    }
}

