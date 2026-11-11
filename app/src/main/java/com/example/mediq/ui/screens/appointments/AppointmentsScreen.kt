package com.example.mediq.ui.screens.appointments

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.mediq.ui.components.MediQPageHeader
import com.example.mediq.ui.navigation.Screen
import com.example.mediq.ui.screens.appointments.AppointmentCancellationStore
import com.example.mediq.ui.theme.MediQScaffoldBackground
import com.example.mediq.ui.theme.MediQGreen
import com.example.mediq.ui.viewmodel.AppointmentsViewModel
import com.example.mediq.ui.viewmodel.NotificationsViewModel
import kotlinx.coroutines.flow.map

/** Where the patient came from, handed back by the detail screen. */
private const val SOURCE_TAB_KEY = "appointment_source_tab"

/** What the detail screen sets when a booking is cancelled. */
private const val CANCELLED_ID_KEY = "cancelled_appointment_id"

/**
 * Appointments.
 *
 * Job: track bookings. Primary action: open one booking.
 *
 * Bookings are loaded from the API via [AppointmentsViewModel]; sample data is
 * no longer used in the running app.
 *
 * Pull-to-refresh reloads the appointment list. The notification count shows
 * how many unread appointment-related notifications are waiting.
 */
@Composable
fun AppointmentsScreen(
    navController: NavController,
    viewModel: AppointmentsViewModel = viewModel(),
    notificationsViewModel: NotificationsViewModel = viewModel()
) {
    var selectedTabIndex by rememberSaveable { mutableIntStateOf(0) }
    var cancelledIds by rememberSaveable { mutableStateOf(emptySet<String>()) }

    val bookings by viewModel.appointments.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    val notificationCount by notificationsViewModel.notifications.map { list ->
        list.count { item -> item.unread }
    }.collectAsState(initial = 0).value

    LaunchedEffect(viewModel) {
        viewModel.loadAppointments()
    }

    val selectedTab = AppointmentsTab.entries[selectedTabIndex]

    val backStackEntry by navController.currentBackStackEntryAsState()

    val sourceTab = backStackEntry?.savedStateHandle?.get<Int>(SOURCE_TAB_KEY)
    LaunchedEffect(sourceTab) {
        if (sourceTab != null) {
            selectedTabIndex = AppointmentsTab
                .fromIndex(sourceTab)
                ?.ordinal
                ?: selectedTabIndex
            backStackEntry?.savedStateHandle?.remove<Int>(SOURCE_TAB_KEY)
        }
    }

    val cancelledId = backStackEntry?.savedStateHandle?.get<String>(CANCELLED_ID_KEY)
    LaunchedEffect(cancelledId) {
        if (!cancelledId.isNullOrBlank()) {
            cancelledIds = cancelledIds + cancelledId
            selectedTabIndex = AppointmentsTab.History.ordinal
            backStackEntry?.savedStateHandle?.remove<String>(CANCELLED_ID_KEY)
        }
    }

    val all = bookings
    val upcoming = all.filter { it.status.canCancel }.take(6)
    val history = all.filterNot { it.status.canCancel }
    val content = AppointmentsUiState.Content(upcoming = upcoming, history = history).withCancelled(cancelledIds)

    val state = when {
        isLoading -> AppointmentsUiState.Loading
        error != null -> AppointmentsUiState.Error(error.orEmpty())
        else -> content
    }

    AppointmentsContent(
        state = state,
        selectedTab = selectedTab,
        actions = AppointmentsActions(
            onRetry = { viewModel.loadAppointments() },
            onOpenAppointment = { id, fromTab ->
                navController.currentBackStackEntry
                    ?.savedStateHandle
                    ?.set(SOURCE_TAB_KEY, fromTab.ordinal)
                navController.navigate(Screen.AppointmentDetails.createRoute(id))
            },
            onRefresh = { viewModel.loadAppointments() },
            notificationCount = notificationCount,
            onNotificationClick = { navController.navigate(Screen.Notifications.route) },
            onTabSelected = { selectedTabIndex = it.ordinal }
        )
    )
}

@Composable
fun AppointmentsContent(
    state: AppointmentsUiState,
    selectedTab: AppointmentsTab,
    actions: AppointmentsActions
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MediQScaffoldBackground)
    ) {
        MediQPageHeader(
            title = "My appointments",
            subtitle = "Upcoming and past visits"
        )

        if (actions.notificationCount > 0) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = androidx.compose.foundation.layout.Arrangement.End
            ) {
                Row(
                    modifier = Modifier
                        .background(MediQGreen)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "${actions.notificationCount} unread",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                }
            }
        }

        AppointmentTabs(selected = selectedTab, onSelect = actions.onTabSelected)

        when (state) {
            AppointmentsUiState.Loading -> AppointmentsLoadingState()

            is AppointmentsUiState.Error -> AppointmentsErrorState(
                message = state.message,
                onRetry = actions.onRetry
            )

            is AppointmentsUiState.Content -> AppointmentsList(
                tab = selectedTab,
                bookings = state.forTab(selectedTab),
                onOpen = { booking ->
                    actions.onOpenAppointment(booking.id, selectedTab)
                },
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}
