package com.example.mediq.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.example.mediq.ui.components.MediQPageHeader
import com.example.mediq.ui.components.MediQNotice
import com.example.mediq.ui.navigation.Screen
import com.example.mediq.ui.theme.MediQBackground
import com.example.mediq.ui.theme.MediQError
import com.example.mediq.ui.theme.MediQErrorContainer
import com.example.mediq.ui.theme.MediQSpacing
import com.example.mediq.ui.theme.MediQTextPrimary
import com.example.mediq.ui.theme.MediQTextSecondary
import com.example.mediq.ui.viewmodel.AuthViewModel
import kotlinx.coroutines.launch

/** The saved-state key the email step leaves the address under. */
internal const val RESET_EMAIL_KEY = "reset_password_email"

/**
 * Forgot password, step 1: which email.
 *
 * Job: collect the email on the account and generate a local one-time code.
 * Primary action: send the code. No email or SMS is sent — the code appears
 * on this device.
 */
@Composable
fun ForgotPasswordScreen(
    navController: NavController,
    viewModel: AuthViewModel = viewModel()
) {
    val scope = rememberCoroutineScope()
    var email by rememberSaveable { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var generating by remember { mutableStateOf(false) }

    ForgotPasswordContent(
        email = email,
        onEmailChange = { email = it; error = null },
        error = error,
        generating = generating,
        onBack = { navController.popBackStack() },
        onSendCode = {
            val address = email.trim()
            if (address.isEmpty()) {
                error = "Enter your email address"
                return@ForgotPasswordContent
            }
            generating = true
            scope.launch {
                val emailError = AuthValidation.validateEmail(address)
                if (emailError != null) {
                    generating = false
                    error = emailError
                    return@launch
                }
                viewModel.requestResetOtp(address)
                generating = false
                navController.currentBackStackEntry
                    ?.savedStateHandle
                    ?.set(RESET_EMAIL_KEY, address)
                navController.navigate(Screen.ResetPassword.route)
            }
        }
    )
}

/** The email step. Everything below this point is previewable. */
@Composable
fun ForgotPasswordContent(
    email: String,
    onEmailChange: (String) -> Unit,
    error: String?,
    generating: Boolean,
    onBack: () -> Unit,
    onSendCode: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MediQBackground)
    ) {
        MediQPageHeader(title = RESET_TITLE, onBack = onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = MediQSpacing.gutter)
        ) {
            Spacer(Modifier.height(MediQSpacing.xl))

            Text(
                text = "Reset your password",
                style = MaterialTheme.typography.titleLarge,
                color = MediQTextPrimary
            )

            Spacer(Modifier.height(MediQSpacing.xs))

            Text(
                text = "Enter the email on your account. A code will appear on this screen to verify it is you.",
                style = MaterialTheme.typography.bodyMedium,
                color = MediQTextSecondary
            )

            Spacer(Modifier.height(MediQSpacing.xxl))

            AuthField(
                value = email,
                onValueChange = onEmailChange,
                label = "Email address",
                placeholder = "name@example.com",
                error = error,
                enabled = !generating,
                keyboardType = KeyboardType.Text
            )

            if (error != null) {
                Spacer(Modifier.height(MediQSpacing.md))

                MediQNotice(
                    icon = Icons.Outlined.CloudOff,
                    message = error,
                    container = MediQErrorContainer,
                    content = MediQError
                )
            }

            Spacer(Modifier.height(MediQSpacing.xxl))

            AuthPrimaryButton(
                label = if (generating) "Generating code..." else "Send code",
                enabled = !generating,
                onClick = onSendCode
            )

            Spacer(Modifier.height(MediQSpacing.xxl))
        }
    }
}

/** The title both reset steps carry. */
internal const val RESET_TITLE = "Reset password"
