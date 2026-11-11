package com.example.mediq.ui.screens.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.HourglassEmpty
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.example.mediq.ui.components.MediQNotice
import com.example.mediq.ui.theme.MediQError
import com.example.mediq.ui.theme.MediQErrorContainer
import com.example.mediq.ui.theme.MediQGreen
import com.example.mediq.ui.theme.MediQLightGreen
import com.example.mediq.ui.theme.MediQSize
import com.example.mediq.ui.theme.MediQSpacing
import com.example.mediq.ui.theme.MediQTextSecondary
import com.example.mediq.ui.theme.MediQWarning
import com.example.mediq.ui.theme.MediQWarningContainer

/*
 * The three parts of the code step that are not fields or buttons: the badge
 * above the heading, what went wrong with the code, and the resend control.
 */

/** The mark above the heading. Decorative — the heading already says what this is. */
@Composable
internal fun OtpBadge(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .size(MediQSize.control)
            .background(MediQLightGreen, MaterialTheme.shapes.medium),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Outlined.ChatBubbleOutline,
            contentDescription = null,
            tint = MediQGreen,
            modifier = Modifier.size(MediQSize.iconLarge)
        )
    }
}

/** Why the code was refused, if it was. */
@Composable
internal fun OtpNotice(state: OtpState, modifier: Modifier = Modifier) {
    val icon = when (state) {
        OtpState.Expired -> Icons.Outlined.HourglassEmpty
        is OtpState.Error -> Icons.Filled.Error
        OtpState.Sent, OtpState.Verifying -> return
    }

    Spacer(Modifier.height(MediQSpacing.md))

    MediQNotice(
        icon = icon,
        message = when (state) {
            OtpState.Expired -> "That code has expired. Ask for a new one to continue."
            is OtpState.Error -> state.message
            else -> ""
        },
        container = when (state) {
            OtpState.Expired -> MediQWarningContainer
            else -> MediQErrorContainer
        },
        content = when (state) {
            OtpState.Expired -> MediQWarning
            else -> MediQError
        },
        modifier = modifier
    )
}

/**
 * The resend line.
 *
 * While the cooldown runs there is nothing to press, so it is a countdown and
 * not a disabled button: a dead control invites taps that do nothing. Once the
 * count is down — or the code has already expired — it becomes the action.
 */
@Composable
internal fun ResendControl(
    secondsLeft: Int,
    locked: Boolean,
    enabled: Boolean,
    onResend: () -> Unit,
    modifier: Modifier = Modifier
) {
    if (locked) {
        Text(
            text = AuthValidation.resendLabel(secondsLeft),
            style = MaterialTheme.typography.labelLarge,
            color = MediQTextSecondary,
            modifier = modifier.padding(start = MediQSpacing.xs)
        )
    } else {
        TextButton(
            onClick = onResend,
            enabled = enabled,
            contentPadding = PaddingValues(horizontal = MediQSpacing.xxs),
            modifier = modifier.heightIn(min = MediQSize.minTouchTarget)
        ) {
            Text(
                text = "Resend code",
                style = MaterialTheme.typography.labelLarge,
                color = MediQGreen
            )
        }
    }
}
