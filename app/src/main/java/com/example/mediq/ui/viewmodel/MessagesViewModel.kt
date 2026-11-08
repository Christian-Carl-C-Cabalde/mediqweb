package com.example.mediq.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.mediq.data.api.SupabaseApiService
import com.example.mediq.data.model.MessageThread
import com.example.mediq.ui.session.DisplayName
import com.example.mediq.ui.screens.messages.ChatMessage
import com.example.mediq.ui.screens.messages.MessagesUiState
import com.example.mediq.ui.screens.messages.MockConversations
import com.example.mediq.ui.screens.messages.SecretaryConversation
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MessagesViewModel : ViewModel() {
    private val api = SupabaseApiService()

    private val _uiState = MutableStateFlow<MessagesUiState>(MessagesUiState.Loading)
    val uiState: StateFlow<MessagesUiState> = _uiState.asStateFlow()

    fun loadConversations() {
        viewModelScope.launch {
            _uiState.value = MessagesUiState.Loading
            try {
                val threads = api.getConversations()
                val conversations = threads.map { thread ->
                    val existing = MockConversations.find { it.id == thread.id }
                    if (existing != null) existing
                    else SecretaryConversation(
                        id = thread.id,
                        secretaryName = thread.subject,
                        initials = DisplayName.initials(thread.subject),
                        doctorName = "",
                        preview = thread.subject.takeIf { it.isNotBlank() } ?: "",
                        date = thread.lastMessageAt,
                        unreadCount = thread.unreadCount,
                    )
                }
                _uiState.value = if (conversations.isEmpty()) {
                    MessagesUiState.Empty
                } else {
                    MessagesUiState.Content(conversations)
                }
            } catch (e: Exception) {
                _uiState.value = MessagesUiState.Error(e.message ?: "Failed to load messages")
            }
        }
    }
}
