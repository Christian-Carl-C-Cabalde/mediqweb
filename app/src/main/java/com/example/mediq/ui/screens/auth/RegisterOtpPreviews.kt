package com.example.mediq.ui.screens.auth

import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import com.example.mediq.ui.theme.MediQTheme

/*
 * The code step and the account-created screen, every state, renderable
 * without a device.
 */

private val sampleActions = RegisterActions()

@Preview(name = "Register code - sent", showBackground = true, heightDp = 800)
@Composable
private fun OtpSentPreview() {
    MediQTheme {
        RegisterOtpContent(
            state = AuthSamples.otpSent,
            otpCode = "123456",
            resendSecondsLeft = AuthValidation.OTP_RESEND_SECONDS,
            actions = sampleActions
        )
    }
}

@Preview(name = "Register code - resend ready", showBackground = true, heightDp = 800)
@Composable
private fun OtpResendReadyPreview() {
    MediQTheme {
        RegisterOtpContent(
            state = AuthSamples.otpSent,
            otpCode = "123456",
            resendSecondsLeft = 0,
            actions = sampleActions
        )
    }
}

@Preview(name = "Register code - incomplete", showBackground = true, heightDp = 800)
@Composable
private fun OtpIncompletePreview() {
    MediQTheme {
        RegisterOtpContent(
            state = AuthSamples.otpSent,
            otpCode = "123456",
            resendSecondsLeft = 0,
            actions = sampleActions
        )
    }
}

@Preview(name = "Register code - expired", showBackground = true, heightDp = 800)
@Composable
private fun OtpExpiredPreview() {
    MediQTheme {
        RegisterOtpContent(
            state = AuthSamples.otpExpired,
            otpCode = "123456",
            resendSecondsLeft = AuthValidation.OTP_RESEND_SECONDS,
            actions = sampleActions
        )
    }
}

@Preview(name = "Register code - verifying", showBackground = true, heightDp = 800)
@Composable
private fun OtpVerifyingPreview() {
    MediQTheme {
        RegisterOtpContent(
            state = AuthSamples.otpVerifying,
            otpCode = "123456",
            resendSecondsLeft = 0,
            actions = sampleActions
        )
    }
}

@Preview(name = "Register code - rejected", showBackground = true, heightDp = 800)
@Composable
private fun OtpRejectedPreview() {
    MediQTheme {
        RegisterOtpContent(
            state = AuthSamples.otpRejected,
            otpCode = "123456",
            resendSecondsLeft = 0,
            actions = sampleActions
        )
    }
}

@Preview(name = "Register - account created", showBackground = true, heightDp = 700)
@Composable
private fun RegisterSuccessPreview() {
    MediQTheme {
        RegisterSuccessContent(actions = sampleActions)
    }
}
