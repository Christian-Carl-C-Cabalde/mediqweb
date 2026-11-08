package com.example.mediq.ui.viewmodel

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.mediq.data.api.SupabaseApiService
import com.example.mediq.data.model.Notification as ApiNotification
import com.example.mediq.data.model.NotificationType as ApiNotificationType
import com.example.mediq.ui.screens.notifications.NotificationHelper
import com.example.mediq.ui.screens.notifications.NotificationItem
import com.example.mediq.ui.screens.notifications.NotificationType
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Holds the patient's notifications loaded from the API and promotes each one
 * to a real Android system notification so the appointment events surface in
 * the system shade as well as the in-app list.
 */
class NotificationsViewModel(private val context: Context) : ViewModel() {

    private val _notifications = MutableStateFlow<List<NotificationItem>>(emptyList())
    val notifications: StateFlow<List<NotificationItem>> = _notifications.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val api = SupabaseApiService()

    init {
        viewModelScope.launch {
            // Channel must exist before any notification is posted.
            NotificationHelper.init(context)
            loadNotifications()
        }
    }

    /** Loads the patient's real notifications from the API. */
    fun loadNotifications() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val apiNotifications = api.getNotifications()
                _notifications.value = apiNotifications.map { toNotificationItem(it) }
                NotificationHelper.notifyAll(context, _notifications.value)
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load notifications"
            } finally {
                _isLoading.value = false
            }
        }
    }

    private fun toNotificationItem(api: ApiNotification): NotificationItem =
        NotificationItem(
            id = api.id,
            type = toUiType(api.type),
            title = api.title,
            message = api.body,
            time = api.createdAt,
            unread = !api.isRead
        )

    private fun toUiType(type: ApiNotificationType): NotificationType = when (type) {
        ApiNotificationType.APPOINTMENT_CONFIRMED -> NotificationType.CONFIRMED
        ApiNotificationType.APPOINTMENT_BOOKED -> NotificationType.CONFIRMED
        ApiNotificationType.APPOINTMENT_REMINDER -> NotificationType.REMINDER
        ApiNotificationType.APPOINTMENT_CANCELLED -> NotificationType.CANCELLED
        else -> NotificationType.CONFIRMED
    }
}

