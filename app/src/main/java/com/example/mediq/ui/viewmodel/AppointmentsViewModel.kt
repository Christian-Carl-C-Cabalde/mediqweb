package com.example.mediq.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.mediq.data.api.SupabaseApiService
import com.example.mediq.data.model.Appointment as ApiAppointment
import com.example.mediq.data.model.AppointmentStatus as ApiAppointmentStatus
import com.example.mediq.data.model.Doctor
import com.example.mediq.data.model.MessageThread
import com.example.mediq.ui.session.DateTimeFormatter
import com.example.mediq.ui.session.DisplayName
import com.example.mediq.ui.screens.appointments.AppointmentBooking
import com.example.mediq.ui.screens.appointments.AppointmentStatus
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AppointmentsViewModel : ViewModel() {
    private val api = SupabaseApiService()

    private val _appointments = MutableStateFlow<List<AppointmentBooking>>(emptyList())
    val appointments: StateFlow<List<AppointmentBooking>> = _appointments.asStateFlow()

    private val _appointmentDetail = MutableStateFlow<AppointmentBooking?>(null)
    val appointmentDetail: StateFlow<AppointmentBooking?> = _appointmentDetail.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    /** Loads the patient's real bookings from the API, never sample data. */
    fun loadAppointments() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val result = api.getAppointments()
                val doctors = api.getDoctors().items
                val conversations = api.getConversations()
                _appointments.value = result.items.map { toBooking(it, doctors, conversations) }
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load appointments"
            } finally {
                _isLoading.value = false
            }
        }
    }

    /** Loads one real booking by id, used by the detail screen. */
    fun loadAppointment(id: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            try {
                val appt = api.getAppointment(id)
                val doctors = api.getDoctors().items
                val conversations = api.getConversations()
                _appointmentDetail.value = toBooking(appt, doctors, conversations)
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to load appointment"
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun cancelAppointment(id: String) {
        viewModelScope.launch {
            try {
                api.cancelAppointment(id)
                loadAppointments()
            } catch (e: Exception) {
                _error.value = e.message ?: "Failed to cancel appointment"
            }
        }
    }

    private fun toBooking(
        appt: ApiAppointment,
        doctors: List<Doctor>,
        conversations: List<MessageThread>
    ): AppointmentBooking {
        val doctor = doctors.find { it.id == appt.doctorId || it.userId == appt.doctorId }
        val conversation = conversations.firstOrNull {
            it.patientId == appt.patientId && it.doctorId == appt.doctorId
        }
        return AppointmentBooking(
            id = appt.id,
            doctor = doctor?.fullName ?: "Unknown doctor",
            initials = DisplayName.initials(doctor?.fullName ?: "Unknown"),
            specialty = doctor?.specialty ?: "",
            dateShort = DateTimeFormatter.formatDate(appt.startsAt),
            dateLong = DateTimeFormatter.formatDateLong(appt.startsAt),
            time = DateTimeFormatter.formatTime(appt.startsAt),
            location = DateTimeFormatter.formatLocation(doctor?.location),
            reason = appt.reason,
            status = toUiStatus(appt.status),
            conversationId = conversation?.id ?: ""
        )
    }

    private fun toUiStatus(status: ApiAppointmentStatus): AppointmentStatus =
        when (status) {
            ApiAppointmentStatus.CONFIRMED -> AppointmentStatus.Confirmed
            ApiAppointmentStatus.BOOKED -> AppointmentStatus.AwaitingConfirmation
            ApiAppointmentStatus.COMPLETED -> AppointmentStatus.Completed
            ApiAppointmentStatus.CANCELLED -> AppointmentStatus.Cancelled
            ApiAppointmentStatus.NO_SHOW -> AppointmentStatus.Completed
        }
}
