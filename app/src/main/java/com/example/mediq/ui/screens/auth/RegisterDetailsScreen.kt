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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.navigation.NavController
import com.example.mediq.ui.components.MediQPageHeader
import com.example.mediq.ui.components.MediQNotice
import com.example.mediq.ui.navigation.Screen
import com.example.mediq.ui.session.MediQSession
import com.example.mediq.ui.theme.MediQBackground
import com.example.mediq.ui.theme.MediQError
import com.example.mediq.ui.theme.MediQErrorContainer
import com.example.mediq.ui.theme.MediQSpacing
import com.example.mediq.ui.theme.MediQTextPrimary
import com.example.mediq.ui.theme.MediQTextSecondary

/**
 * Registration step 1: who the patient is.
 *
 * Job: collect a name and an email (required) plus an optional mobile number.
 * Primary action: continue to the one-time-code step.
 */
@Composable
fun RegisterDetailsScreen(
    navController: NavController,
    state: RegisterState = AuthSamples.registerIdle
) {
    RegisterDetailsContent(
        state = state,
        actions = RegisterActions(
            onBack = { navController.popBackStack() },
            onDetailsContinue = { fullName, email, phoneNumber ->
                /*
                 * The details step is the only place a full name is ever asked
                 * for, so it is kept here for the account the credentials step
                 * is about to create.
                 */
                MediQSession.beginRegistration(fullName, email, phoneNumber)

                /*
                 * Generate a local 6-digit OTP code on this device. No email
                 * or SMS is involved — the code is shown on the next screen.
                 */
                MediQSession.generateLocalOtp()

                navController.navigate(Screen.RegisterOTP.route)
            }
        )
    )
}

@Composable
fun RegisterDetailsContent(
    state: RegisterState,
    actions: RegisterActions,
    initialErrors: DetailsErrors = DetailsErrors(null, null, null),
    modifier: Modifier = Modifier
) {
    var fullName by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var phoneNumber by rememberSaveable { mutableStateOf("") }
    var errors by remember { mutableStateOf(initialErrors) }

    val submitting = state == RegisterState.Submitting

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(MediQBackground)
    ) {
        MediQPageHeader(title = REGISTRATION_TITLE, onBack = actions.onBack)

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = MediQSpacing.gutter)
        ) {
            Spacer(Modifier.height(MediQSpacing.xl))

            RegistrationProgress(currentStep = 1)

            Spacer(Modifier.height(MediQSpacing.xl))

            Text(
                text = "Your details",
                style = MaterialTheme.typography.titleLarge,
                color = MediQTextPrimary
            )

            Spacer(Modifier.height(MediQSpacing.xs))

            Text(
                text = "We only collect what is needed to schedule your consultations.",
                style = MaterialTheme.typography.bodyMedium,
                color = MediQTextSecondary
            )

            Spacer(Modifier.height(MediQSpacing.xxl))

            AuthField(
                value = fullName,
                onValueChange = { fullName = it },
                label = "Full name",
                placeholder = AuthSamples.FULL_NAME,
                error = errors.fullName,
                enabled = !submitting
            )

            Spacer(Modifier.height(MediQSpacing.lg))

            AuthField(
                value = email,
                onValueChange = { email = it },
                label = "Email address",
                placeholder = "name@example.com",
                error = errors.email,
                hint = "Used for verification and sign-in.",
                enabled = !submitting,
                keyboardType = KeyboardType.Text
            )

            Spacer(Modifier.height(MediQSpacing.lg))

            AuthField(
                value = phoneNumber,
                onValueChange = { phoneNumber = it },
                label = "Mobile number",
                placeholder = AuthSamples.PHONE_NUMBER,
                error = errors.phoneNumber,
                hint = "Optional. Used for appointment reminders.",
                enabled = !submitting,
                keyboardType = KeyboardType.Phone
            )

            if (state is RegisterState.Error) {
                Spacer(Modifier.height(MediQSpacing.md))

                MediQNotice(
                    icon = Icons.Outlined.CloudOff,
                    message = state.message,
                    container = MediQErrorContainer,
                    content = MediQError
                )
            }

            Spacer(Modifier.height(MediQSpacing.xxl))

            AuthPrimaryButton(
                label = if (submitting) "Sending code..." else "Continue",
                enabled = !submitting,
                onClick = {
                    val checked = AuthValidation.validateDetails(fullName, email, phoneNumber)
                    errors = checked
                    if (checked.isClean) {
                        actions.onDetailsContinue(fullName.trim(), email.trim(), phoneNumber)
                    }
                }
            )

            Spacer(Modifier.height(MediQSpacing.xxl))
        }
    }
}
