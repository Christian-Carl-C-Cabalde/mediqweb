package com.example.mediq.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.mediq.data.api.SupabaseApiService
import com.example.mediq.data.model.Appointment
import com.example.mediq.data.model.AppointmentStatus as ApiAppointmentStatus
import com.example.mediq.data.model.Doctor
import com.example.mediq.ui.session.DateTimeFormatter
import com.example.mediq.ui.session.DisplayName
import com.example.mediq.ui.screens.notifications.MockNotifications
import com.example.mediq.ui.screens.notifications.NotificationItem
import com.example.mediq.ui.screens.notifications.NotificationType
import com.example.mediq.ui.screens.home.AppointmentStatus as HomeAppointmentStatus
import com.example.mediq.ui.screens.home.DoctorAvailability
import com.example.mediq.ui.screens.home.HomeUiState
import com.example.mediq.ui.screens.home.NextAppointment
import com.example.mediq.ui.screens.home.PatientSummary
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Clock
import java.time.Instant

/**
 * Home screen data loader.
 *
 * Kicks off all API calls when the Home screen enters the composition and
 * emits [HomeUiState.Loading], [HomeUiState.Content] or [HomeUiState.Error].
 * On failure an error message is shown — never fake data.
 */
class HomeViewModel : ViewModel() {
    private val api = SupabaseApiService()

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            loadHome()
        }
    }

    private suspend fun loadHome() {
        try {
            _uiState.value = HomeUiState.Loading

            val profile = api.getProfile()
            val specialties = api.getSpecializations()
            val appointments = api.getAppointments()
            val doctors = api.getDoctors()

            val patient = PatientSummary(
                firstName = DisplayName.firstName(profile.fullName),
                fullName = profile.fullName,
            )

            val specialtyNames = specialties.map { it.name }

            val nextAppointment = nextAppointment(appointments.items, doctors.items)

            val openSlots = doctors.items.map { doctor ->
                DoctorAvailability(
                    doctorId = doctor.id,
                    name = doctor.fullName,
                    specialty = doctor.specialty,
                    location = DateTimeFormatter.formatLocation(doctor.location),
                )
            }

            val unreadCount = MockNotifications.count { it.unread }

            _uiState.value = HomeUiState.Content(
                patient = patient,
                nextAppointment = nextAppointment,
                specialties = specialtyNames,
                openSlots = openSlots,
                unreadNotifications = unreadCount,
            )
        } catch (e: Exception) {
            _uiState.value = HomeUiState.Error(e.message ?: "We couldn't load your home screen")
        }
    }
}

/**
 * The earliest upcoming appointment to surface on the home card, or null
 * when there is nothing to show.
 *
 * An appointment is upcoming when it starts now or later and its status is
 * booked or confirmed. Cancelled, completed and past appointments are
 * excluded, and the card never falls back to sample data.
 *
 * [now] defaults to the device clock; pass a fixed instant in tests.
 */
fun nextAppointment(
    appointments: List<Appointment>,
    doctors: List<Doctor>,
    now: Instant = Clock.systemDefaultZone().instant()
): NextAppointment? {
    val upcoming = appointments
        .filter { it.status == ApiAppointmentStatus.CONFIRMED || it.status == ApiAppointmentStatus.BOOKED }
        .filter { !DateTimeFormatter.instant(it.startsAt).isBefore(now) }
        .minByOrNull { DateTimeFormatter.instant(it.startsAt) }
        ?: return null

    val doctor = doctors.find { it.id == upcoming.doctorId || it.userId == upcoming.doctorId }
    return NextAppointment(
        id = upcoming.id,
        time = DateTimeFormatter.formatTime(upcoming.startsAt),
        date = DateTimeFormatter.formatDate(upcoming.startsAt),
        doctorName = doctor?.fullName ?: "Unknown doctor",
        specialty = doctor?.specialty ?: "",
        location = DateTimeFormatter.formatLocation(doctor?.location),
        arrivalNote = "",
        status = toHomeStatus(upcoming.status),
    )
}

private fun toHomeStatus(status: ApiAppointmentStatus): HomeAppointmentStatus =
    // Only booked or confirmed appointments reach this point; anything else
    // was filtered out before the card was considered.
    if (status == ApiAppointmentStatus.CONFIRMED) HomeAppointmentStatus.Confirmed
    else HomeAppointmentStatus.Pending

/** The notification badge label, or null when nothing should be shown. */
fun badgeLabel(count: Int): String? = when {
    count <= 0 -> null
    count > 9 -> "9+"
    else -> count.toString()
}
