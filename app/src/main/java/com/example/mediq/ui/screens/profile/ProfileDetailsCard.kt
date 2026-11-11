package com.example.mediq.ui.screens.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import com.example.mediq.ui.theme.MediQBackground
import com.example.mediq.ui.theme.MediQBorder
import com.example.mediq.ui.theme.MediQError
import com.example.mediq.ui.theme.MediQErrorBorder
import com.example.mediq.ui.theme.MediQErrorContainer
import com.example.mediq.ui.theme.MediQHeaderControl
import com.example.mediq.ui.theme.MediQOnBrand
import com.example.mediq.ui.theme.MediQSize
import com.example.mediq.ui.theme.MediQSpacing
import com.example.mediq.ui.theme.MediQTextPrimary
import com.example.mediq.ui.theme.MediQTextSecondary

@Composable
private fun ProfileInitialsAvatar(initials: String) {
    Box(
        modifier = Modifier
            .size(MediQSize.control)
            .clip(CircleShape)
            .background(MediQHeaderControl),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = initials,
            style = MaterialTheme.typography.labelLarge,
            color = MediQOnBrand
        )
    }
}

/** A label/value row in the personal details card. */
@Composable
internal fun ProfileDetailRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = MediQSpacing.md, vertical = MediQSpacing.md),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = MediQTextSecondary)
        Text(text = value, style = MaterialTheme.typography.labelMedium, color = MediQTextPrimary)
    }
}

/** The card with profile details and the edit button. */
@Composable
internal fun ProfileDetailsCard(
    profile: ProfileData,
    onEdit: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MediQBackground,
        border = BorderStroke(MediQSize.hairline, MediQBorder)
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = MediQSpacing.md, vertical = MediQSpacing.md),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ProfileInitialsAvatar(initials = profile.initials)
                Spacer(Modifier.width(MediQSpacing.md))
                Text(
                    text = profile.fullName,
                    style = MaterialTheme.typography.titleMedium,
                    color = MediQTextPrimary
                )
            }

            HorizontalDivider(color = MediQBorder, modifier = Modifier.padding(horizontal = MediQSpacing.md))

            val details = profileDetails(profile)
            details.forEachIndexed { index, detail ->
                ProfileDetailRow(label = detail.label, value = detail.value)
                if (index < details.lastIndex) {
                    HorizontalDivider(color = MediQBorder, modifier = Modifier.padding(horizontal = MediQSpacing.md))
                }
            }

            if (details.isNotEmpty()) {
                HorizontalDivider(color = MediQBorder, modifier = Modifier.padding(horizontal = MediQSpacing.md))
            }

            // Doctor-specific fields
            profile.specialization?.let { spec ->
                HorizontalDivider(color = MediQBorder, modifier = Modifier.padding(horizontal = MediQSpacing.md))
                ProfileDetailRow(
                    label = "Specialization",
                    value = spec,
                    modifier = Modifier.padding(horizontal = MediQSpacing.md, vertical = MediQSpacing.md),
                )
            }
            profile.licenseNumber?.let { lic ->
                HorizontalDivider(color = MediQBorder, modifier = Modifier.padding(horizontal = MediQSpacing.md))
                ProfileDetailRow(
                    label = "License number",
                    value = lic,
                    modifier = Modifier.padding(horizontal = MediQSpacing.md, vertical = MediQSpacing.md),
                )
            }
            profile.joinedOn?.let { joined ->
                HorizontalDivider(color = MediQBorder, modifier = Modifier.padding(horizontal = MediQSpacing.md))
                ProfileDetailRow(
                    label = "Joined MediQ",
                    value = joined,
                    modifier = Modifier.padding(horizontal = MediQSpacing.md, vertical = MediQSpacing.md),
                )
            }

            OutlinedButton(
                onClick = onEdit,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(MediQSpacing.md)
                    .heightIn(min = MediQSize.minTouchTarget),
                shape = MaterialTheme.shapes.medium,
                border = BorderStroke(MediQSize.hairline, MediQBorder),
                colors = ButtonDefaults.outlinedButtonColors(contentColor = MediQTextPrimary)
            ) {
                Icon(
                    imageVector = Icons.Default.Edit,
                    contentDescription = "Edit",
                    tint = MediQTextPrimary,
                    modifier = Modifier.size(MediQSize.icon)
                )
                Spacer(Modifier.width(MediQSpacing.sm))
                Text(text = "Edit my details", style = MaterialTheme.typography.labelLarge)
            }
        }
    }
}

/** The sign-out button. */
@Composable
internal fun SignOutButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = MediQSize.minTouchTarget),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(MediQSize.hairline, MediQErrorBorder),
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = MediQErrorContainer,
            contentColor = MediQError
        )
    ) {
        Icon(
            imageVector = Icons.Default.Logout,
            contentDescription = "Sign out",
            tint = MediQError,
            modifier = Modifier.size(MediQSize.icon)
        )
        Spacer(Modifier.width(MediQSpacing.sm))
        Text(text = "Sign out", style = MaterialTheme.typography.labelLarge, color = MediQError)
    }
}