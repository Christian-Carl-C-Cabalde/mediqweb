package com.example.mediq.ui.screens.profile

import com.example.mediq.data.model.UserProfile
import com.example.mediq.ui.session.DisplayName
import com.example.mediq.ui.session.SignedInUser

/*
 * What the profile and edit-profile screens can be doing.
 */

data class ProfileData(
    val fullName: String,
    val email: String? = null,
    val initials: String,
    val phoneNumber: String? = null,
    val dateOfBirth: String? = null,
    val specialization: String? = null,
    val licenseNumber: String? = null,
    val joinedOn: String? = null,
)

val MockProfile = ProfileData(
    fullName = "Arweyne Zoe Salcedo",
    email = "zoe.salcedo@email.com",
    initials = DisplayName.initials("Arweyne Zoe Salcedo"),
    phoneNumber = "0917 442 8810",
    dateOfBirth = "1990-01-01"
)

sealed interface ProfileUiState {
    data object Loading : ProfileUiState
    data class Error(val message: String) : ProfileUiState
    data class Content(val profile: ProfileData) : ProfileUiState
}

data class ProfileActions(
    val onEdit: () -> Unit = {},
    val onSignOut: () -> Unit = {}
)

/** Edit profile is simpler: idle, dirty, saving, saved, error. */
sealed interface EditProfileUiState {
    data object Idle : EditProfileUiState
    data class Error(val message: String) : EditProfileUiState
    data object Saving : EditProfileUiState
    data object Saved : EditProfileUiState
}

data class EditProfileActions(
    val onBack: () -> Unit = {},
    val onSave: (String, String) -> Unit = { _, _ -> }
)

data class ProfileDetail(val label: String, val value: String)

fun profileDetails(profile: ProfileData): List<ProfileDetail> =
    listOf(
        ProfileDetail("Email", profile.email ?: ""),
        ProfileDetail("Mobile number", profile.phoneNumber ?: ""),
        ProfileDetail("Date of birth", profile.dateOfBirth ?: "")
    ).filter { it.value.isNotBlank() }

fun UserProfile.toProfileData(): ProfileData =
    ProfileData(
        fullName = fullName,
        email = email?.takeIf { it.isNotBlank() },
        initials = DisplayName.initials(fullName),
        phoneNumber = mobileNumber.takeIf { it.isNotBlank() },
        dateOfBirth = dateOfBirth.takeIf { it.isNotBlank() },
        specialization = specialization.takeIf { it.isNotBlank() },
        licenseNumber = licenseNumber.takeIf { it.isNotBlank() },
        joinedOn = createdAt.takeIf { it.isNotBlank() },
    )

fun SignedInUser.toProfileData(): ProfileData =
    ProfileData(
        fullName = fullName,
        email = email?.takeIf { it.isNotBlank() },
        initials = DisplayName.initials(fullName),
        phoneNumber = phoneNumber?.takeIf { it.isNotBlank() },
        dateOfBirth = null
    )