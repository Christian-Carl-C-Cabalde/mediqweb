package com.example.mediq.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class ApiFailure(
    val code: String,
    val message: String,
    val details: Map<String, String>? = null,
)

@Serializable
sealed class LoadState<out T> {
    @Serializable data class Loading<T>(val progress: Float = 0f) : LoadState<T>()
    @Serializable data class Success<T>(val data: T) : LoadState<T>()
    @Serializable data class Error(val failure: ApiFailure) : LoadState<Nothing>()
}

@Serializable
enum class AppointmentStatus {
    @SerialName("booked") BOOKED,
    @SerialName("confirmed") CONFIRMED,
    @SerialName("completed") COMPLETED,
    @SerialName("cancelled") CANCELLED,
    @SerialName("no_show") NO_SHOW,
}

@Serializable
enum class VisitOutcome {
    @SerialName("completed") COMPLETED,
    @SerialName("no_show") NO_SHOW,
}

@Serializable
data class Appointment(
    val id: String,
    val patientId: String,
    val doctorId: String,
    val startsAt: String,
    val durationMinutes: Int,
    val status: AppointmentStatus,
    val reason: String,
    val createdAt: String,
    val updatedAt: String,
    val completedAt: String? = null,
    val outcome: VisitOutcome? = null,
)

@Serializable
data class AppointmentFilter(
    val doctorId: String? = null,
    val patientId: String? = null,
    val status: AppointmentStatus? = null,
    val from: String? = null,
    val to: String? = null,
    val limit: Int = 50,
    val offset: Int = 0,
)

@Serializable
data class AuthSession(
    val accessToken: String,
    val expiresAt: String,
    val refreshToken: String,
    val refreshExpiresAt: String,
    val profile: UserProfile,
)

@Serializable
data class AvailableDate(
    val date: String,
    val sessions: List<TimeSlot>,
    val isOverride: Boolean,
)

@Serializable
data class BookingRequest(
    val patientId: String,
    val doctorId: String,
    val startsAt: String,
    val durationMinutes: Int,
    val reason: String,
)

@Serializable
data class ClinicHours(
    val dayOfWeek: Int,
    val startTime: String,
    val endTime: String,
    val isClosed: Boolean = false,
)

@Serializable
data class ClinicLocation(
    val building: String,
    val floor: String,
    val room: String,
)

@Serializable
data class ConsultationLanguage(
    val code: String,
    val name: String,
)

@Serializable
data class Doctor(
    val id: String,
    val userId: String,
    val fullName: String,
    val specialty: String,
    val specializationId: String,
    val licenseNumber: String,
    val yearsOfExperience: Int,
    val feeCentavos: Long,
    val bio: String,
    val location: ClinicLocation,
    val languages: List<ConsultationLanguage>,
    val status: DoctorStatus,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
enum class DoctorStatus {
    @SerialName("active") ACTIVE,
    @SerialName("inactive") INACTIVE,
    @SerialName("on_leave") ON_LEAVE,
}

@Serializable
data class DoctorQuery(
    val specializationId: String? = null,
    val search: String? = null,
    val status: DoctorStatus? = null,
    val limit: Int = 20,
    val offset: Int = 0,
)

@Serializable
data class Message(
    val id: String,
    val conversationId: String,
    val authorId: String,
    val authorRole: MessageAuthorRole,
    val body: String,
    val sentAt: String,
    val readAt: String? = null,
)

@Serializable
enum class MessageAuthorRole {
    @SerialName("patient") PATIENT,
    @SerialName("doctor") DOCTOR,
    @SerialName("secretary") SECRETARY,
}

@Serializable
data class MessageThread(
    val id: String,
    val patientId: String,
    val doctorId: String,
    val subject: String,
    val lastMessageAt: String,
    val unreadCount: Int,
    val awaitingAction: Boolean,
)

@Serializable
data class Money(
    val centavos: Long,
    val currency: String = "PHP",
)

@Serializable
data class Notification(
    val id: String,
    val userId: String,
    val type: NotificationType,
    val title: String,
    val body: String,
    val data: Map<String, String>? = null,
    val isRead: Boolean = false,
    val createdAt: String,
    val readAt: String? = null,
)

@Serializable
enum class NotificationType {
    @SerialName("appointment_booked") APPOINTMENT_BOOKED,
    @SerialName("appointment_confirmed") APPOINTMENT_CONFIRMED,
    @SerialName("appointment_cancelled") APPOINTMENT_CANCELLED,
    @SerialName("appointment_reminder") APPOINTMENT_REMINDER,
    @SerialName("message_received") MESSAGE_RECEIVED,
    @SerialName("system") SYSTEM,
}

@Serializable
data class Paged<T>(
    val items: List<T>,
    val total: Long,
    val limit: Int,
    val offset: Int,
)

@Serializable
data class RegisterRequest(
    val username: String,
    val password: String,
    val fullName: String,
    val email: String,
    val mobileNumber: String?,
    val dateOfBirth: String,
    val role: UserRole,
)

@Serializable
data class RegistrationDraft(
    val username: String,
    val password: String,
    val fullName: String,
    val email: String?,
    val mobileNumber: String,
    val dateOfBirth: String,
    val role: UserRole,
    val practice: DoctorPractice? = null,
    val assignedDoctorId: String? = null,
)

@Serializable
data class RequestOtpRequest(
    val contact: String,
    val purpose: OtpPurpose,
)

@Serializable
enum class OtpPurpose {
    @SerialName("register") REGISTER,
    @SerialName("reset_password") RESET_PASSWORD,
}

@Serializable
data class RescheduleRequest(
    val startsAt: String,
    val durationMinutes: Int,
)

@Serializable
enum class Sex {
    @SerialName("male") MALE,
    @SerialName("female") FEMALE,
    @SerialName("other") OTHER,
}

@Serializable
data class SignInRequest(
    val username: String,
    val password: String,
)

@Serializable
enum class SlotStatus {
    @SerialName("available") AVAILABLE,
    @SerialName("booked") BOOKED,
    @SerialName("blocked") BLOCKED,
}

@Serializable
data class Specialty(
    val id: String,
    val name: String,
    val description: String?,
    val doctorCount: Int = 0,
)

@Serializable
data class TimeSlot(
    val startTime: String,
    val endTime: String,
    val status: SlotStatus = SlotStatus.AVAILABLE,
    val appointmentId: String? = null,
)

@Serializable
data class UserProfile(
    val id: String,
    val username: String,
    val fullName: String,
    val email: String?,
    val mobileNumber: String,
    val dateOfBirth: String,
    val role: UserRole,
    val status: AccountStatus,
    val doctorId: String? = null,
    val assignedDoctorId: String? = null,
    val createdAt: String,
    val updatedAt: String,
    val specialization: String = "",
    val licenseNumber: String = "",
    val joinedOn: String = "",
)

@Serializable
enum class UserRole {
    @SerialName("patient") PATIENT,
    @SerialName("doctor") DOCTOR,
    @SerialName("secretary") SECRETARY,
    @SerialName("admin") ADMIN,
}

@Serializable
enum class AccountStatus {
    @SerialName("active") ACTIVE,
    @SerialName("inactive") INACTIVE,
    @SerialName("pending_verification") PENDING_VERIFICATION,
    @SerialName("suspended") SUSPENDED,
}

@Serializable
data class VerifyOtpRequest(
    val contact: String,
    val code: String,
    val purpose: OtpPurpose,
)

/** The new password a patient chose after proving they own the number. */
@Serializable
data class UpdatePasswordRequest(
    val newPassword: String
)

@Serializable
data class DoctorPractice(
    val specializationId: String,
    val licenseNumber: String,
    val yearsExperience: Int,
    val feeCentavos: Long,
    val bio: String,
    val building: String,
    val floor: String,
    val room: String,
    val languages: List<ConsultationLanguage>,
)

@Serializable
data class StaffDraft(
    val username: String,
    val name: String,
    val email: String?,
    val mobileNumber: String?,
    val dateOfBirth: String?,
    val temporaryPassword: String?,
    val status: AccountStatus = AccountStatus.ACTIVE,
    val practice: DoctorPractice? = null,
    val assignedDoctorId: String? = null,
)

@Serializable
data class AdminAccountsResponse(
    val patients: List<UserProfile>,
    val doctors: List<UserProfile>,
    val secretaries: List<UserProfile>,
)

@Serializable
data class ProfileDraft(
    val name: String? = null,
    val email: String? = null,
    val mobileNumber: String? = null,
)

@Serializable
data class StaffPracticeDraft(
    val specializationId: String,
    val licenseNumber: String,
    val yearsExperience: Int,
    val feeCentavos: Long,
    val bio: String,
    val building: String,
    val floor: String,
    val room: String,
    val languages: List<ConsultationLanguage>,
)