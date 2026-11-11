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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.example.mediq.ui.components.MediQPageHeader
import com.example.mediq.ui.navigation.Screen
import com.example.mediq.ui.session.MediQSession
import com.example.mediq.ui.theme.MediQBackground
import com.example.mediq.ui.theme.MediQSpacing
import com.example.mediq.ui.theme.MediQTextPrimary
import com.example.mediq.ui.theme.MediQTextSecondary
import com.example.mediq.ui.viewmodel.AuthViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** How often the resend countdown ticks. */
private const val OTP_TICK_MILLIS = 1_000L

/**
 * Registration step 2: prove the contact with a locally shown code.
 *
 * Job: show a 6-digit code on this device and check what the patient types.
 * Primary action: verify. No email or SMS is involved.
 */
@Composable
fun RegisterOtpScreen(
    navController: NavController,
    viewModel: AuthViewModel = viewModel()
) {
    val secondsLeft = rememberSaveable {
        mutableStateOf(AuthValidation.OTP_RESEND_SECONDS)
    }
    val state = remember { mutableStateOf<OtpState>(OtpState.Sent) }
    val codeError = remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    /*
     * The locally generated code lives in MediQSession. Read it here so it can
     * be displayed on screen for the patient to read and type back.
     */
    val otpCode = MediQSession.currentOtpCode

    /*
     * One ticker for as long as the screen is open. It only writes state while
     * a countdown is running.
     */
    LaunchedEffect(Unit) {
        while (true) {
            delay(OTP_TICK_MILLIS)
            if (secondsLeft.value > 0) secondsLeft.value--
        }
    }

    RegisterOtpContent(
        state = state.value,
        otpCode = otpCode,
        resendSecondsLeft = secondsLeft.value,
        actions = RegisterActions(
            onBack = { navController.popBackStack() },
            onOtpVerify = { typed ->
                scope.launch {
                    state.value = OtpState.Verifying
                    codeError.value = null
                    if (viewModel.verifyLocalOtp(typed)) {
                        navController.navigate(Screen.RegisterCredentials.route)
                    } else {
                        state.value = OtpState.Error("That code is not right. Check the six digits and try again.")
                    }
                }
            },
            onOtpResend = {
                secondsLeft.value = AuthValidation.OTP_RESEND_SECONDS
                viewModel.generateLocalOtp()
                // code is re-read from MediQSession on recomposition
            },
        )
    )
}

/**
 * The code form.
 *
 * [otpCode] is the locally generated 6-digit code, displayed prominently so the
 * patient can read it from this device rather than waiting for email or SMS.
 */
@Composable
fun RegisterOtpContent(
    state: OtpState,
    otpCode: String?,
    resendSecondsLeft: Int,
    actions: RegisterActions,
    modifier: Modifier = Modifier
) {
    val code = rememberSaveable { mutableStateOf("") }
    val codeError = remember { mutableStateOf<String?>(null) }
    val verifying = state == OtpState.Verifying
    val resendLocked = resendSecondsLeft > 0 && state != OtpState.Expired

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

            RegistrationProgress(currentStep = 2)

            Spacer(Modifier.height(MediQSpacing.xl))

            OtpBadge()

            Spacer(Modifier.height(MediQSpacing.lg))

            Text(
                text = "Verify your registration",
                style = MaterialTheme.typography.titleLarge,
                color = MediQTextPrimary
            )

            Spacer(Modifier.height(MediQSpacing.xs))

            Text(
                text = "Enter the code shown below to continue.",
                style = MaterialTheme.typography.bodyMedium,
                color = MediQTextSecondary
            )

            Spacer(Modifier.height(MediQSpacing.xxl))

            // The locally generated code, displayed in large digits.
            otpCode?.let { displayed ->
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = MediQSpacing.gutter)
                        .align(Alignment.CenterHorizontally)
                ) {
                    Text(
                        text = displayed.chunked(2).joinToString(" "),
                        style = MaterialTheme.typography.displayMedium,
                        color = MediQTextPrimary,
                        modifier = Modifier
                            .padding(vertical = MediQSpacing.lg)
                            .background(
                                color = MaterialTheme.colorScheme.surfaceContainerHighest,
                                shape = MaterialTheme.shapes.medium
                            )
                            .padding(horizontal = MediQSpacing.xl)
                    )
                }
            }

            Spacer(Modifier.height(MediQSpacing.xxl))

            OtpNotice(state = state)

            Spacer(Modifier.height(MediQSpacing.xxl))

            AuthField(
                value = code.value,
                onValueChange = { typed ->
                    code.value = typed.filter { it.isDigit() }.take(AuthValidation.OTP_LENGTH)
                    codeError.value = null
                },
                label = "One-time code",
                placeholder = "123456",
                error = codeError.value,
                enabled = !verifying,
                keyboardType = KeyboardType.Number
            )

            ResendControl(
                secondsLeft = resendSecondsLeft,
                locked = resendLocked,
                enabled = !verifying,
                onResend = actions.onOtpResend
            )

            Spacer(Modifier.height(MediQSpacing.xxl))

            AuthPrimaryButton(
                label = if (verifying) "Verifying..." else "Verify",
                enabled = !verifying && code.value.length == AuthValidation.OTP_LENGTH,
                onClick = {
                    val checked = AuthValidation.validateOtp(code.value)
                    codeError.value = checked
                    if (checked == null) actions.onOtpVerify(code.value)
                }
            )

            Spacer(Modifier.height(MediQSpacing.xxl))
        }
    }
}
