package com.example.mediq.ui.screens.appointments

/**
 * One booking, as the list and the detail screen both need it.
 *
 * There is one copy of this data across both screens, so the day shown in the
 * list cannot drift from the day shown when the patient opens it. The list
 * reads [dateShort]; the detail screen reads [dateLong].
 */
data class AppointmentBooking(
    val id: String,
    val doctor: String,
    val initials: String,
    val specialty: String,
    val dateShort: String,
    val dateLong: String,
    val time: String,
    val location: String,
    val reason: String,
    val status: AppointmentStatus,
    /** The secretary thread this booking belongs to. */
    val conversationId: String
)

/** The two lists the screen switches between. */
enum class AppointmentsTab(val label: String) {
    Upcoming("Upcoming"),
    History("History");

    companion object {
        /** The tab at [index], or null when the index is out of range. */
        fun fromIndex(index: Int?): AppointmentsTab? = entries.getOrNull(index ?: -1)
    }
}

/** What the screen was handed. */
sealed interface AppointmentsUiState {

    /** Skeleton that mirrors the result list. */
    data object Loading : AppointmentsUiState

    /**
     * Bookings loaded, split by tab.
     *
     * Either list being empty is a normal state: the screen says which kind of
     * nothing it is ("no upcoming visits" is not "no history").
     */
    data class Content(
        val upcoming: List<AppointmentBooking>,
        val history: List<AppointmentBooking>
    ) : AppointmentsUiState {

        /** The bookings behind [tab]. */
        fun forTab(tab: AppointmentsTab): List<AppointmentBooking> = when (tab) {
            AppointmentsTab.Upcoming -> upcoming
            AppointmentsTab.History -> history
        }
    }

    /** Anything that stopped the list loading; says what happened. */
    data class Error(val message: String) : AppointmentsUiState
}

/** Callbacks the appointments screen raises. */
data class AppointmentsActions(
    val onRetry: () -> Unit = {},
    /** Opens one booking; [fromTab] remembers where the patient came from. */
    val onOpenAppointment: (id: String, fromTab: AppointmentsTab) -> Unit = { _, _ -> },
    /** Pull-to-refresh reloads the appointment list. */
    val onRefresh: () -> Unit = {},
    /** Current count of unread notifications. */
    val notificationCount: Int = 0,
    /** Tap to open the notifications screen. */
    val onNotificationClick: () -> Unit = {},
    /** Tab selection changed. */
    val onTabSelected: (AppointmentsTab) -> Unit = { _ -> }
)
