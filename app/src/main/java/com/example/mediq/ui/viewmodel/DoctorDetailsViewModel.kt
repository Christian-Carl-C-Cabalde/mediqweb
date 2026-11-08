package com.example.mediq.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.mediq.data.api.SupabaseApiService
import com.example.mediq.data.model.ClinicHours
import com.example.mediq.data.model.Doctor
import com.example.mediq.ui.screens.doctordetails.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId

/**
 * Loads a doctor's profile and weekly schedule from the API so the
 * doctor-details screen shows real, live data instead of hard-coded samples.
 *
 * When a doctor changes their schedule on the server, the next time this
 * screen opens it fetches the updated clinic hours and renders them.
 */
class DoctorDetailsViewModel : ViewModel() {
    private val api = SupabaseApiService()

    private val _uiState = MutableStateFlow<DoctorDetailsUiState>(DoctorDetailsUiState.Loading)
    /** The current UI state: loading, error, or loaded with profile + schedule. */
    val uiState: StateFlow<DoctorDetailsUiState> = _uiState.asStateFlow()

    /**
     * Loads the doctor's profile and schedule for [doctorId].
     *
     * Safe to call repeatedly; each call resets to Loading while it fetches.
     */
    fun loadDoctor(doctorId: String) {
        viewModelScope.launch {
            _uiState.value = DoctorDetailsUiState.Loading
            try {
                val doctor = api.getDoctor(doctorId)
                val clinicHours = api.getDoctorSchedule(doctorId)

                val profile = toDoctorProfile(doctor, clinicHours)
                val schedule = buildDateSchedules(clinicHours)

                _uiState.value = DoctorDetailsUiState.Content(
                    doctor = profile,
                    schedule = schedule
                )
            } catch (e: Exception) {
                _uiState.value = DoctorDetailsUiState.Error(
                    message = e.message ?: "We couldn't load this doctor"
                )
            }
        }
    }

    /**
     * Maps the server [Doctor] and its [clinicHours] to the UI [DoctorProfile].
     */
    private fun toDoctorProfile(doctor: Doctor, clinicHours: List<ClinicHours>): DoctorProfile {
        val initials = doctor.fullName
            .split(" ")
            .filter { it.isNotEmpty() }
            .joinToString("") { it.first().uppercase().toString() }
            .take(2)
            .ifEmpty { "DR" }

        return DoctorProfile(
            id = doctor.id,
            initials = initials,
            name = doctor.fullName,
            specialty = doctor.specialty,
            location =
                "${doctor.location.building} — ${doctor.location.floor}F · ${doctor.location.room}",
            experienceYears = doctor.yearsOfExperience,
            consultationFee = (doctor.feeCentavos / 100).toInt(),
            bio = doctor.bio,
            licenseNumber = doctor.licenseNumber,
            clinicHours = clinicHours.map { ch ->
                ClinicHour(
                    day = dayOfWeekName(ch.dayOfWeek),
                    time = "${ch.startTime} – ${ch.endTime}"
                )
            }
        )
    }

    /**
     * Builds the day strip from [clinicHours].
     *
     * Looks ahead 14 days from today. For each date whose day-of-week matches a
     * clinic day (and is not closed), it creates a [DateSchedule] with slot
     * statuses derived from that day's clinic hours.
     */
    private fun buildDateSchedules(clinicHours: List<ClinicHours>): List<DateSchedule> {
        val byDayOfWeek = clinicHours.groupBy { it.dayOfWeek }
        val today = LocalDate.now(ZoneId.of("UTC"))
        val schedules = mutableListOf<DateSchedule>()

        for (i in 0..13) {
            val date = today.plusDays(i.toLong())
            val javaDow = date.dayOfWeek // MONDAY=1 .. SUNDAY=7
            val serverDayOfWeek = (javaDow.value % 7) // 0=Sunday .. 6=Saturday
            val hoursForDay = byDayOfWeek[serverDayOfWeek]?.filter { !it.isClosed } ?: continue

            val statuses = buildSlotStatusesForDay(hoursForDay)
            val option = DateOption(
                day = javaDow.name.take(3).lowercase().capitalize(),
                date = date.dayOfMonth
            )
            schedules.add(DateSchedule(option = option, statuses = statuses))
        }

        return schedules
    }

    /**
     * Turns one day's clinic hours into a status for every [AllTimeSlots] time.
     *
     * Slots that fall within any open clinic hour are [TimeSlotStatus.AVAILABLE];
     * everything else is [TimeSlotStatus.RESERVED].
     */
    private fun buildSlotStatusesForDay(clinicHoursForDay: List<ClinicHours>): Map<String, TimeSlotStatus> {
        return AllTimeSlots.associateWith { slot ->
            val slotMinutes = time12hToMinutes(slot)
            val available = clinicHoursForDay.any { ch ->
                val start = time24hToMinutes(ch.startTime)
                val end = time24hToMinutes(ch.endTime)
                slotMinutes >= start && slotMinutes < end
            }
            if (available) TimeSlotStatus.AVAILABLE else TimeSlotStatus.RESERVED
        }
    }

    /** "09:00" (24h) -> minutes since midnight. */
    private fun time24hToMinutes(time: String): Int {
        val parts = time.split(":")
        return parts[0].toInt() * 60 + parts[1].toInt()
    }

    /** "9:00 AM" / "4:30 PM" (12h) -> minutes since midnight. */
    private fun time12hToMinutes(time: String): Int {
        val (timePart, amPm) = time.split(" ")
        val (hour, minute) = timePart.split(":")
        var h = hour.toInt()
        if (amPm == "PM" && h != 12) h += 12
        if (amPm == "AM" && h == 12) h = 0
        return h * 60 + minute.toInt()
    }

    /** Server day-of-week (0=Sunday..6=Saturday) -> display name. */
    private fun dayOfWeekName(serverDayOfWeek: Int): String {
        return when (serverDayOfWeek) {
            0 -> "Sunday"
            1 -> "Monday"
            2 -> "Tuesday"
            3 -> "Wednesday"
            4 -> "Thursday"
            5 -> "Friday"
            6 -> "Saturday"
            else -> "Unknown"
        }
    }
}
