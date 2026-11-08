package com.example.mediq.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.example.mediq.data.api.SupabaseClient
import com.example.mediq.ui.components.MediQPageHeader
import com.example.mediq.ui.navigation.Screen
import com.example.mediq.ui.session.MediQSession
import com.example.mediq.ui.theme.MediQScaffoldBackground
import com.example.mediq.ui.theme.MediQSpacing
import com.example.mediq.ui.viewmodel.ProfileViewModel

/**
 * Profile.
 *
 * Job: manage account and health data. Primary action: edit profile.
 */
@Composable
fun ProfileScreen(
    navController: NavController,
    viewModel: ProfileViewModel = viewModel()
) {
    var showSignOutDialog by remember { mutableStateOf(false) }
    val user by MediQSession.user.collectAsState()
    val profile by viewModel.profile.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()
    val authError by viewModel.authError.collectAsState()

    // Load from the API whenever a signed-in user exists (including after
    // sign-in or a sign-in/refresh that swaps the account). Never MockProfile.
    LaunchedEffect(user) {
        if (user != null) {
            viewModel.loadProfile()
        }
    }

    // A 401 means the access token is invalid/expired: the ViewModel has
    // already signed the user out. Send them to the sign-in screen.
    LaunchedEffect(authError) {
        if (authError) {
            navController.navigate(Screen.SignIn.route) { popUpTo(0) }
        }
    }

    val state = when {
        authError -> ProfileUiState.Loading
        isLoading && profile == null -> ProfileUiState.Loading
        error != null && profile == null -> ProfileUiState.Error(error.orEmpty())
        profile != null -> ProfileUiState.Content(profile!!.toProfileData())
        user != null -> ProfileUiState.Content(user!!.toProfileData())
        isLoading -> ProfileUiState.Loading
        else -> ProfileUiState.Error("We could not load your profile. Check your connection and try again.")
    }

    ProfileContent(
        state = state,
        actions = ProfileActions(
            onEdit = { navController.navigate(Screen.EditProfile.route) },
            onSignOut = { showSignOutDialog = true }
        ),
        showSignOutDialog = showSignOutDialog,
        onDismissSignOut = { showSignOutDialog = false },
        onConfirmSignOut = {
            showSignOutDialog = false
            MediQSession.signOut()
            SupabaseClient.accessToken = null
            navController.navigate(Screen.SignIn.route) { popUpTo(0) }
        }
    )
}

/** State switch. Everything below is navigation-free and previewable. */
@Composable
fun ProfileContent(
    state: ProfileUiState,
    actions: ProfileActions,
    showSignOutDialog: Boolean,
    onDismissSignOut: () -> Unit,
    onConfirmSignOut: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MediQScaffoldBackground)
    ) {
        when (state) {
            ProfileUiState.Loading -> ProfileLoadingState()
            is ProfileUiState.Error -> ProfileErrorState(message = state.message, onRetry = {})
            is ProfileUiState.Content -> {
                MediQPageHeader(title = "Profile")

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                        .padding(horizontal = MediQSpacing.gutter)
                ) {
                    Spacer(Modifier.height(MediQSpacing.lg))

                    ProfileDetailsCard(profile = state.profile, onEdit = actions.onEdit)

                    Spacer(Modifier.height(MediQSpacing.md))

                    SignOutButton(onClick = actions.onSignOut)
                }
            }
        }

        SignOutDialog(
            show = showSignOutDialog,
            onDismiss = onDismissSignOut,
            onConfirm = onConfirmSignOut
        )
    }
}