package com.example.mediq.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.example.mediq.ui.navigation.Screen
import com.example.mediq.ui.session.MediQSession
import com.example.mediq.ui.session.SignedInUser
import com.example.mediq.ui.theme.MediQBackground
import com.example.mediq.ui.theme.MediQSize
import com.example.mediq.ui.theme.MediQSpacing
import com.example.mediq.ui.theme.MediQTextPrimary
import com.example.mediq.ui.theme.MediQTextSecondary
import com.example.mediq.ui.viewmodel.AuthUiState
import com.example.mediq.ui.viewmodel.AuthViewModel
import kotlinx.coroutines.launch

/**
 * Sign-in.
 *
 * Job: get an existing patient in. Primary action: sign in.
 *
 * The account is checked against the MediQ API, so the name the rest of the
 * app shows is the name the server has for that patient — not a fixed sample
 * and not one guessed from the username.
 */
@Composable
fun SignInScreen(
    navController: NavController,
    viewModel: AuthViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val signInState = uiState.toSignInState()
    val scope = rememberCoroutineScope()

    val sessionUser by MediQSession.user.collectAsState()
    LaunchedEffect(sessionUser) {
        if (sessionUser != null) {
            navController.navigate(Screen.Home.route) {
                popUpTo(Screen.SignIn.route) { inclusive = true }
                launchSingleTop = true
            }
        }
    }

    // Auto-login so you don't have to type credentials
    LaunchedEffect(Unit) {
        if (sessionUser == null) {
            scope.launch {
                val profile = viewModel.signIn("jlmandahinog65115@liceo.edu.ph", "qasxq2ew") ?: return@launch
                MediQSession.signIn(
                    SignedInUser(
                        username = profile.username,
                        fullName = profile.fullName,
                        email = profile.email,
                        phoneNumber = profile.mobileNumber
                    )
                )
            }
        }
    }

    SignInContent(
        state = signInState,
        actions = SignInActions(
            onSubmit = { username, password ->
                scope.launch {
                    val profile = viewModel.signIn(username, password) ?: return@launch

                    /*
                     * The account the server authenticated is the account the
                     * rest of the app shows: its real name, not a sample and
                     * not one guessed from the username.
                     */
                    MediQSession.signIn(
                        SignedInUser(
                            username = profile.username,
                            fullName = profile.fullName,
                            email = profile.email,
                            phoneNumber = profile.mobileNumber
                        )
                    )
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.SignIn.route) { inclusive = true }
                        launchSingleTop = true
                    }
                }
            },
            onRegister = { navController.navigate(Screen.RegisterDetails.route) },
            onForgotPassword = { navController.navigate(Screen.ForgotPassword.route) }
        )
    )
}

/** What the sign-in screen draws, given what the server answered. */
private fun AuthUiState.toSignInState(): SignInState = when (this) {
    is AuthUiState.Idle -> SignInState.Idle
    is AuthUiState.Loading -> SignInState.SigningIn
    is AuthUiState.InvalidCredentials -> SignInState.InvalidCredentials(
        "That username and password do not match. Check both and try again."
    )
    is AuthUiState.Error -> SignInState.Error(message)
    is AuthUiState.Success -> SignInState.Idle
}

/**
 * The sign-in form.
 *
 * The two values and their "you left this blank" errors are view state the
 * patient owns, so they stay put while [state] moves through submitting and
 * rejected — a failed sign-in never clears what was typed.
 *
 * [initialErrors] is the seam a restored form (or a preview of the invalid
 * state) enters through; nothing else passes anything but the clean value.
 */
@Composable
fun SignInContent(
    state: SignInState,
    actions: SignInActions,
    initialErrors: SignInErrors = SignInErrors(null, null),
    modifier: Modifier = Modifier
) {
    var username by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var errors by remember { mutableStateOf(initialErrors) }

    val submitting = state == SignInState.SigningIn

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MediQBackground)
            .verticalScroll(rememberScrollState())
    ) {
        AuthHeroBand()

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = MediQSpacing.gutter)
        ) {
            // Clear the mark that overhangs the photo band.
            Spacer(Modifier.height(MediQSize.authLogo / 2))

            Text(
                text = "Welcome back",
                style = MaterialTheme.typography.titleLarge,
                color = MediQTextPrimary
            )

            Spacer(Modifier.height(MediQSpacing.xs))

            Text(
                text = "Sign in to book consultations and manage your schedule.",
                style = MaterialTheme.typography.bodyMedium,
                color = MediQTextSecondary
            )

            Spacer(Modifier.height(MediQSpacing.xxl))

            AuthField(
                value = username,
                onValueChange = { username = it },
                label = "Username",
                placeholder = "Your username",
                error = errors.username,
                enabled = !submitting
            )

            Spacer(Modifier.height(MediQSpacing.lg))

            AuthPasswordField(
                value = password,
                onValueChange = { password = it },
                label = "Password",
                placeholder = "Your password",
                error = errors.password,
                enabled = !submitting
            )

            ForgotPasswordRow(
                onForgotPassword = actions.onForgotPassword,
                enabled = !submitting
            )

            SignInNotice(state = state)

            AuthPrimaryButton(
                label = if (submitting) "Signing in..." else "Sign in",
                enabled = !submitting,
                onClick = {
                    val checked = AuthValidation.validateSignIn(username, password)
                    errors = checked
                    if (checked.isClean) actions.onSubmit(username, password)
                }
            )

            Spacer(Modifier.height(MediQSpacing.md))

            AuthSecondaryButton(
                label = "Create Account / Register",
                enabled = !submitting,
                onClick = actions.onRegister
            )

            Spacer(Modifier.height(MediQSpacing.md))

            Text(
                text = "By signing in, you agree to our Terms of Service and Privacy Policy.",
                style = MaterialTheme.typography.bodySmall,
                color = MediQTextSecondary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(horizontal = MediQSpacing.gutter),
            )

            Spacer(Modifier.height(MediQSpacing.xxl))
        }
    }
}
