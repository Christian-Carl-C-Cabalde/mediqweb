package com.example.mediq.data.api

import com.example.mediq.data.model.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.json.JSONArray
import org.json.JSONObject
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

val JSON_MEDIA_TYPE = "application/json".toMediaType()

fun jsonBody(vararg pairs: Pair<String, Any?>): String {
    val sb = StringBuilder("{")
    var first = true
    for ((k, v) in pairs) {
        if (!first) sb.append(",")
        first = false
        sb.append("\"$k\":")
        sb.append(when (v) {
            null -> "null"
            is String -> {
                val s = v
                if (s.startsWith("{") && s.endsWith("}")) s else "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
            }
            else -> v.toString()
        })
    }
    sb.append("}")
    return sb.toString()
}

fun <T> JSONArray.map(transform: (JSONObject) -> T): List<T> {
    return (0 until length()).map { transform(getJSONObject(it)) }
}

class SupabaseApiService {
    private val sb = SupabaseClient.client

    private suspend fun httpRequest(
        method: String,
        url: String,
        auth: Boolean = false,
        body: String? = null,
    ): String = withContext(Dispatchers.Default) {
        val requestBuilder = Request.Builder()
            .url(url.toHttpUrl())
        if (body == null) {
            requestBuilder.method(method, null)
        } else {
            requestBuilder.method(method, RequestBody.create(JSON_MEDIA_TYPE, body!!))
        }
        requestBuilder
            .header("apikey", SupabaseClient.anonKey)
            .header("Content-Type", "application/json")
        if (auth) {
            SupabaseClient.accessToken?.let { token ->
                requestBuilder.header("Authorization", "Bearer $token")
            }
        } else {
            requestBuilder.header("Authorization", "Bearer ${SupabaseClient.anonKey}")
        }
        if (method != "GET" && method != "HEAD") {
            requestBuilder.header("Prefer", "return=representation")
        }
        val response = sb.newCall(requestBuilder.build()).execute()
        val responseBody = response.body?.string() ?: ""
        if (!response.isSuccessful) {
            throw RuntimeException("HTTP ${response.code}: $responseBody")
        }
        return@withContext responseBody
    }

    // ========================================================================
    // Auth
    // ========================================================================

    suspend fun signIn(request: SignInRequest): AuthSession = withContext(Dispatchers.Default) {
        val body = httpRequest("POST", "${SupabaseClient.authUrl}/token?grant_type=password", auth = false,
            body = jsonBody("email" to request.username, "password" to request.password))
        val obj = JSONObject(body)
        val accessToken = obj.getString("access_token")
        val refreshToken = obj.optString("refresh_token", "")
        val expiresIn = obj.optInt("expires_in", 3600)
        val user = obj.getJSONObject("user")
        val userId = user.getString("id")
        val userEmail = user.optString("email", null)

        // Profile may not exist yet (RLS deny-all or trigger lag). Fall back to
        // a profile built from the auth user data so sign-in doesn't crash.
        SupabaseClient.accessToken = accessToken
        SupabaseClient.refreshToken = refreshToken
        SupabaseClient.authUserId = userId
        val profile = getProfileByUserId(userId) ?: UserProfile(
            id = userId,
            username = userEmail?.substringBefore("@") ?: userId,
            fullName = userEmail ?: userId,
            email = userEmail,
            mobileNumber = "",
            dateOfBirth = "",
            role = UserRole.PATIENT,
            status = AccountStatus.ACTIVE,
            doctorId = null,
            assignedDoctorId = null,
            createdAt = "",
            updatedAt = "",
        )
        return@withContext AuthSession(
            accessToken = accessToken,
            expiresAt = (System.currentTimeMillis() + expiresIn * 1000).toString(),
            refreshToken = refreshToken,
            refreshExpiresAt = "",
            profile = profile,
        )
    }

    suspend fun register(request: RegisterRequest): AuthSession? = withContext(Dispatchers.Default) {
        val body = httpRequest("POST", "${SupabaseClient.authUrl}/signup", auth = false,
            body = jsonBody(
                "email" to request.email,
                "password" to request.password,
                "data" to jsonBody(
                    "username" to request.username,
                    "full_name" to request.fullName,
                    "mobile_number" to (request.mobileNumber ?: ""),
                    "date_of_birth" to request.dateOfBirth,
                    "role" to request.role.name,
                ),
            ))
        val obj = JSONObject(body)
        val user = obj.getJSONObject("user")
        val userId = user.getString("id")
        val userEmail = user.optString("email", "")

        // Supabase may return no session when email confirmation is required
        // (default on free tier). In that case registration still succeeded
        // but the patient must confirm their email before signing in.
        val sessionObj = obj.optJSONObject("session")
        if (sessionObj == null) {
            return@withContext null
        }

        val accessToken = sessionObj.getString("access_token")
        val refreshToken = sessionObj.optString("refresh_token", "")

        // Profile may not exist yet (RLS deny-all or trigger lag). Set the
        // token first so the profile lookup can authenticate, then fall back
        // to a profile built from the signup data if the read fails.
        SupabaseClient.accessToken = accessToken
        val profile = try {
            getProfileByUserId(userId)
        } catch (e: Exception) {
            null
        } ?: UserProfile(
            id = userId,
            username = request.username,
            fullName = request.fullName,
            email = userEmail.ifBlank { null },
            mobileNumber = request.mobileNumber ?: "",
            dateOfBirth = request.dateOfBirth,
            role = request.role,
            status = AccountStatus.ACTIVE,
            doctorId = null,
            assignedDoctorId = null,
            createdAt = "",
            updatedAt = "",
        )
        SupabaseClient.accessToken = accessToken
        SupabaseClient.refreshToken = refreshToken
        SupabaseClient.authUserId = userId
        return@withContext AuthSession(
            accessToken = accessToken,
            expiresAt = (System.currentTimeMillis() + 3600000).toString(),
            refreshToken = refreshToken,
            refreshExpiresAt = "",
            profile = profile,
        )
    }

    suspend fun requestOtp(request: RequestOtpRequest): Unit = withContext(Dispatchers.Default) {
        httpRequest("POST", "${SupabaseClient.authUrl}/otp", auth = false,
            body = jsonBody(
                "email" to if (request.contact.contains("@")) request.contact else null,
                "phone" to if (request.contact.contains("@")) null else request.contact,
                "data" to jsonBody("purpose" to request.purpose.name),
            ))
    }

    suspend fun verifyOtp(request: VerifyOtpRequest): AuthSession = withContext(Dispatchers.Default) {
        val contact = request.contact.trim()
        val otpType = if (contact.contains("@")) "email" else "sms"
        httpRequest("POST", "${SupabaseClient.authUrl}/verify?token=${request.code}&type=$otpType", auth = false)
        val lookupKey = if (contact.contains("@")) "email" else "username"
        val profileUrl = "${SupabaseClient.restUrl}/profiles?select=*&$lookupKey=eq.$contact"
        val profileResponse = httpRequest("GET", profileUrl, auth = false)
        val arr = JSONArray(profileResponse)
        val first = arr.getJSONObject(0)
        val userId = first.getString("user_id")
        val profile = parseProfile(first)

        val sessionResponse = httpRequest("POST", "${SupabaseClient.authUrl}/token?grant_type=password", auth = false,
            body = jsonBody("email" to (profile.email ?: contact), "password" to request.code))
        val sessionObj = JSONObject(sessionResponse)
        val accessToken = sessionObj.optString("access_token", "")
        if (accessToken.isNotEmpty()) {
            SupabaseClient.accessToken = accessToken
            SupabaseClient.refreshToken = sessionObj.optString("refresh_token", "")
            SupabaseClient.authUserId = userId
        }

        return@withContext AuthSession(
            accessToken = accessToken,
            expiresAt = (System.currentTimeMillis() + 3600000).toString(),
            refreshToken = SupabaseClient.refreshToken ?: "",
            refreshExpiresAt = "",
            profile = profile,
        )
    }

    suspend fun updatePassword(request: UpdatePasswordRequest): UserProfile = withContext(Dispatchers.Default) {
        httpRequest("PATCH", "${SupabaseClient.authUrl}/user", auth = true,
            body = jsonBody("password" to request.newPassword))
        return@withContext getProfile()
    }

    suspend fun refreshToken(): AuthSession = withContext(Dispatchers.Default) {
        val refreshToken = SupabaseClient.refreshToken ?: throw RuntimeException("No refresh token")
        val body = httpRequest("POST", "${SupabaseClient.authUrl}/token?grant_type=refresh_token", auth = false,
            body = jsonBody("refresh_token" to refreshToken))
        val obj = JSONObject(body)
        val accessToken = obj.getString("access_token")
        val newRefreshToken = obj.optString("refresh_token", "")
        SupabaseClient.accessToken = accessToken
        SupabaseClient.refreshToken = newRefreshToken
        val profile = getProfile()
        return@withContext AuthSession(
            accessToken = accessToken,
            expiresAt = (System.currentTimeMillis() + 3600000).toString(),
            refreshToken = newRefreshToken,
            refreshExpiresAt = "",
            profile = profile,
        )
    }

    // ========================================================================
    // Profile
    // ========================================================================

    suspend fun getProfile(): UserProfile = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val userId = getCurrentUserId(session)
        val profile = getProfileByUserId(userId) ?: UserProfile(
            id = userId,
            username = SupabaseClient.authUserId ?: userId,
            fullName = SupabaseClient.authUserId ?: userId,
            email = null,
            mobileNumber = "",
            dateOfBirth = "",
            role = UserRole.PATIENT,
            status = AccountStatus.ACTIVE,
            doctorId = null,
            assignedDoctorId = null,
            createdAt = "",
            updatedAt = "",
        )
        // If doctor, also fetch specialization and license number from doctors table
        val updatedProfile = if (profile.role == UserRole.DOCTOR) {
            try {
                val doctorBody = fetchJson("${SupabaseClient.restUrl}/doctors?select=specialty,license_number&user_id=eq.$userId", session)
                val doctorArr = JSONArray(doctorBody)
                if (doctorArr.length() > 0) {
                    val doctorObj = doctorArr.getJSONObject(0)
                    profile.copy(
                        specialization = doctorObj.optString("specialty", ""),
                        licenseNumber = doctorObj.optString("license_number", ""),
                    )
                } else profile
            } catch (e: Exception) {
                profile
            }
        } else profile
        return@withContext updatedProfile
    }

    suspend fun updateProfile(draft: ProfileDraft): UserProfile = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val userId = getCurrentUserId(session)
        val body = httpRequest("PATCH", "${SupabaseClient.restUrl}/profiles?user_id=eq.$userId", auth = true,
            body = jsonBody(
                "full_name" to (draft.name ?: ""),
                "email" to (draft.email ?: ""),
                "mobile_number" to (draft.mobileNumber ?: ""),
            ))
        val arr = JSONArray(body)
        val first = arr.getJSONObject(0)
        return@withContext parseProfile(first)
    }

    // ========================================================================
    // Doctors
    // ========================================================================

    suspend fun getDoctors(
        specializationId: String? = null,
        search: String? = null,
        status: DoctorStatus? = null,
        limit: Int = 20,
        offset: Int = 0,
    ): Paged<Doctor> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        var url = "${SupabaseClient.restUrl}/doctors?select=*,specializations(*)&limit=$limit&offset=$offset"
        if (specializationId != null) url += "&specialization_id=eq.$specializationId"
        if (search != null) url += "&full_name=ilike.%25$search%25"
        if (status != null) url += "&status=eq.${status.name}"
        val body = fetchJson(url, session)
        val total = extractTotalCount(url, session)
        val arr = JSONArray(body)
        val items = arr.map { parseDoctor(it) }
        return@withContext Paged(items = items, total = total.toLong(), limit = limit, offset = offset)
    }

    suspend fun getDoctor(id: String): Doctor = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val body = fetchJson("${SupabaseClient.restUrl}/doctors?select=*,specializations(*)&id=eq.$id", session)
        val arr = JSONArray(body)
        val first = arr.getJSONObject(0)
        return@withContext parseDoctor(first)
    }

    suspend fun getDoctorSchedule(id: String): List<ClinicHours> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val body = fetchJson("${SupabaseClient.restUrl}/clinic_hours?select=*&doctor_id=eq.$id", session)
        val arr = JSONArray(body)
        return@withContext arr.map { parseClinicHours(it) }
    }

    suspend fun getDoctorAvailability(id: String, date: String): List<AvailableDate> = withContext(Dispatchers.Default) {
        return@withContext listOf(AvailableDate(date = date, sessions = emptyList(), isOverride = false))
    }

    suspend fun getDoctorAppointments(
        id: String,
        from: String? = null,
        to: String? = null,
    ): List<Appointment> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        var url = "${SupabaseClient.restUrl}/appointments?select=*&doctor_id=eq.$id"
        if (from != null) url += "&starts_at=gte.$from"
        if (to != null) url += "&starts_at=lte.$to"
        val body = fetchJson(url, session)
        val arr = JSONArray(body)
        return@withContext arr.map { parseAppointment(it) }
    }

    // ========================================================================
    // Specializations
    // ========================================================================

    suspend fun getSpecializations(): List<Specialty> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val body = fetchJson("${SupabaseClient.restUrl}/specializations?select=*", session)
        val arr = JSONArray(body)
        return@withContext arr.map { parseSpecialty(it) }
    }

    // ========================================================================
    // Appointments
    // ========================================================================

    suspend fun getAppointments(
        status: AppointmentStatus? = null,
        from: String? = null,
        to: String? = null,
        limit: Int = 50,
        offset: Int = 0,
    ): Paged<Appointment> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        var url = "${SupabaseClient.restUrl}/appointments?select=*&limit=$limit&offset=$offset"
        if (status != null) url += "&status=eq.${status.name}"
        if (from != null) url += "&starts_at=gte.$from"
        if (to != null) url += "&starts_at=lte.$to"
        val body = fetchJson(url, session)
        val total = extractTotalCount(url, session)
        val arr = JSONArray(body)
        val items = arr.map { parseAppointment(it) }
        return@withContext Paged(items = items, total = total.toLong(), limit = limit, offset = offset)
    }

    suspend fun createAppointment(request: BookingRequest): Appointment = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val body = httpRequest("POST", "${SupabaseClient.restUrl}/rpc/book_appointment", auth = true,
            body = jsonBody(
                "p_patient_id" to request.patientId,
                "p_doctor_id" to request.doctorId,
                "p_starts_at" to request.startsAt,
                "p_duration_minutes" to request.durationMinutes,
                "p_reason" to request.reason,
            ))
        val arr = JSONArray(body)
        val appointmentId = arr.getJSONObject(0).getString("id")
        return@withContext getAppointment(appointmentId)
    }

    suspend fun getAppointment(id: String): Appointment = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val body = fetchJson("${SupabaseClient.restUrl}/appointments?select=*&id=eq.$id", session)
        val arr = JSONArray(body)
        val first = arr.getJSONObject(0)
        return@withContext parseAppointment(first)
    }

    // ========================================================================
    // Messages
    // ========================================================================

    suspend fun getConversations(): List<MessageThread> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val userId = getCurrentUserId(session)
        val url = "${SupabaseClient.restUrl}/message_threads?select=*&or=(patient_id.eq.$userId,doctor_id.eq.$userId)"
        val body = fetchJson(url, session)
        val arr = JSONArray(body)
        return@withContext arr.map { parseMessageThread(it) }
    }

    suspend fun getMessages(conversationId: String): List<Message> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val body = fetchJson("${SupabaseClient.restUrl}/messages?select=*&conversation_id=eq.$conversationId&order=sent_at.asc", session)
        val arr = JSONArray(body)
        return@withContext arr.map { parseMessage(it) }
    }

    suspend fun sendMessage(conversationId: String, bodyText: String): Message = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        httpRequest("POST", "${SupabaseClient.restUrl}/rpc/send_message", auth = true,
            body = jsonBody("p_conversation_id" to conversationId, "p_body" to bodyText))
        val messages = getMessages(conversationId)
        return@withContext messages.lastOrNull()
            ?: throw RuntimeException("Message sent but not found")
    }

    suspend fun markConversationRead(conversationId: String): Unit = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        httpRequest("PATCH", "${SupabaseClient.restUrl}/message_threads?id=eq.$conversationId", auth = true,
            body = jsonBody("unread_count" to 0, "awaiting_action" to false))
    }

    // ========================================================================
    // Notifications
    // ========================================================================

    suspend fun getNotifications(unread: Boolean = false): List<Notification> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val userId = getCurrentUserId(session)
        var url = "${SupabaseClient.restUrl}/notifications?select=*&user_id=eq.$userId"
        if (unread) url += "&is_read=eq.false"
        val body = fetchJson(url, session)
        val arr = JSONArray(body)
        return@withContext arr.map { parseNotification(it) }
    }

    suspend fun markNotificationRead(id: String): Unit = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        httpRequest("PATCH", "${SupabaseClient.restUrl}/notifications?id=eq.$id", auth = true,
            body = jsonBody("is_read" to true))
    }

    suspend fun markAllNotificationsRead(): Unit = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val userId = getCurrentUserId(session)
        httpRequest("PATCH", "${SupabaseClient.restUrl}/notifications?user_id=eq.$userId&is_read=eq.false", auth = true,
            body = jsonBody("is_read" to true))
    }

    // ========================================================================
    // Admin
    // ========================================================================

    suspend fun getAdminAccounts(): AdminAccountsResponse = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val userId = getCurrentUserId(session)
        val profileBody = fetchJson("${SupabaseClient.restUrl}/profiles?select=*&user_id=eq.$userId", session)
        val arr = JSONArray(profileBody)
        val adminProfile = arr.getJSONObject(0)
        val adminRole = adminProfile.getString("role")
        if (adminRole != "ADMIN") {
            throw RuntimeException("Not authorized: admin role required")
        }

        val allBody = fetchJson("${SupabaseClient.restUrl}/profiles?select=*", session)
        val allArr = JSONArray(allBody)
        val allProfiles = allArr.map { parseProfile(it) }

        return@withContext AdminAccountsResponse(
            patients = allProfiles.filter { it.role == UserRole.PATIENT },
            doctors = allProfiles.filter { it.role == UserRole.DOCTOR },
            secretaries = allProfiles.filter { it.role == UserRole.SECRETARY },
        )
    }

    suspend fun createStaffAccount(kind: String, draft: StaffDraft): UserProfile = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val userId = getCurrentUserId(session)
        val profileBody = fetchJson("${SupabaseClient.restUrl}/profiles?select=*&user_id=eq.$userId", session)
        val arr = JSONArray(profileBody)
        val adminProfile = arr.getJSONObject(0)
        if (adminProfile.getString("role") != "ADMIN") {
            throw RuntimeException("Not authorized: admin role required")
        }

        val body = httpRequest("POST", "${SupabaseClient.restUrl}/profiles", auth = true,
            body = jsonBody(
                "username" to draft.username,
                "full_name" to draft.name,
                "email" to (draft.email ?: ""),
                "role" to kind.uppercase(),
                "status" to draft.status.name,
            ))
        val arr2 = JSONArray(body)
        val first = arr2.getJSONObject(0)
        return@withContext parseProfile(first)
    }

    suspend fun updateAccountStatus(id: String, status: AccountStatus): UserProfile = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val body = httpRequest("PATCH", "${SupabaseClient.restUrl}/profiles?user_id=eq.$id", auth = true,
            body = jsonBody("status" to status.name))
        val arr = JSONArray(body)
        val first = arr.getJSONObject(0)
        return@withContext parseProfile(first)
    }

    // ========================================================================
    // Secretary
    // ========================================================================

    suspend fun getSecretaryAppointments(): List<Appointment> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val userId = getCurrentUserId(session)
        val profileBody = fetchJson("${SupabaseClient.restUrl}/profiles?select=*&user_id=eq.$userId", session)
        val arr = JSONArray(profileBody)
        val secretaryProfile = arr.getJSONObject(0)
        val doctorId = secretaryProfile.getString("assigned_doctor_id")
        val body = fetchJson("${SupabaseClient.restUrl}/appointments?select=*&doctor_id=eq.$doctorId", session)
        val apptArr = JSONArray(body)
        return@withContext apptArr.map { parseAppointment(it) }
    }

    suspend fun confirmAppointment(id: String): Unit = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        httpRequest("POST", "${SupabaseClient.restUrl}/rpc/confirm_appointment", auth = true,
            body = jsonBody("p_appointment_id" to id))
    }

    suspend fun cancelAppointment(id: String): Unit = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        httpRequest("POST", "${SupabaseClient.restUrl}/rpc/cancel_appointment", auth = true,
            body = jsonBody("p_appointment_id" to id))
    }

    suspend fun getSecretaryPatients(): List<UserProfile> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val body = fetchJson("${SupabaseClient.restUrl}/profiles?select=*&role=eq.PATIENT", session)
        val arr = JSONArray(body)
        return@withContext arr.map { parseProfile(it) }
    }

    suspend fun getSecretaryMessages(): List<MessageThread> = withContext(Dispatchers.Default) {
        val session = SupabaseClient.accessToken
            ?: throw RuntimeException("Not authenticated")
        val userId = getCurrentUserId(session)
        val profileBody = fetchJson("${SupabaseClient.restUrl}/profiles?select=*&user_id=eq.$userId", session)
        val arr = JSONArray(profileBody)
        val secretaryProfile = arr.getJSONObject(0)
        val doctorId = secretaryProfile.getString("assigned_doctor_id")
        val body = fetchJson("${SupabaseClient.restUrl}/message_threads?select=*&doctor_id=eq.$doctorId", session)
        val threadArr = JSONArray(body)
        return@withContext threadArr.map { parseMessageThread(it) }
    }

    // ========================================================================
    // Health
    // ========================================================================

    suspend fun healthCheck(): Map<String, String> = withContext(Dispatchers.Default) {
        mapOf("status" to "ok")
    }

    // ========================================================================
    // Private helpers
    // ========================================================================

    private suspend fun fetchJson(url: String, session: String): String {
        return withContext(Dispatchers.Default) {
            sb.newCall(Request.Builder()
                .url(url.toHttpUrl())
                .get()
                .header("apikey", SupabaseClient.anonKey)
                .header("Authorization", "Bearer $session")
                .build()
            ).execute().use { response ->
                if (!response.isSuccessful) {
                    throw RuntimeException("HTTP ${response.code}: ${response.body?.string()}")
                }
                return@withContext response.body?.string() ?: ""
            }
        }
    }

    private suspend fun extractTotalCount(url: String, session: String): Int {
        return withContext(Dispatchers.Default) {
            sb.newCall(Request.Builder()
                .url(url.toHttpUrl())
                .get()
                .header("apikey", SupabaseClient.anonKey)
                .header("Authorization", "Bearer $session")
                .header("Range", "0-0")
                .build()
            ).execute().use { response ->
                val contentRange = response.headers["Content-Range"] ?: ""
                return@withContext contentRange.substringAfterLast("/").toIntOrNull() ?: 0
            }
        }
    }

    private suspend fun getProfileByUserId(userId: String): UserProfile? {
        return try {
            val session = SupabaseClient.accessToken
                ?: throw RuntimeException("Not authenticated")
            val body = fetchJson("${SupabaseClient.restUrl}/profiles?select=*&user_id=eq.$userId", session)
            val arr = JSONArray(body)
            if (arr.length() == 0) return null
            val first = arr.getJSONObject(0)
            parseProfile(first)
        } catch (e: Exception) {
            // RLS deny-all blocks the profile read; fall back to auth-user data
            // so sign-in doesn't crash when no profiles row exists yet.
            null
        }
    }

    private suspend fun getCurrentUserId(session: String): String {
        return SupabaseClient.authUserId
            ?: throw RuntimeException("Not authenticated")
    }

    // --- Model parsers ---

    private fun parseProfile(obj: JSONObject): UserProfile {
        return UserProfile(
            id = obj.getString("user_id"),
            username = obj.getString("username"),
            fullName = obj.optString("full_name", ""),
            email = obj.optString("email", null),
            mobileNumber = obj.optString("mobile_number", ""),
            dateOfBirth = obj.optString("date_of_birth", ""),
            role = UserRole.valueOf(obj.optString("role", "PATIENT").uppercase()),
            status = AccountStatus.valueOf(obj.optString("status", "ACTIVE").uppercase()),
            doctorId = obj.optString("doctor_id", null),
            assignedDoctorId = obj.optString("assigned_doctor_id", null),
            createdAt = obj.optString("created_at", ""),
            updatedAt = obj.optString("updated_at", ""),
            specialization = obj.optString("specialty", ""),
            licenseNumber = obj.optString("license_number", ""),
            joinedOn = obj.optString("created_at", ""),
        )
    }

    private fun parseDoctor(obj: JSONObject): Doctor {
        return Doctor(
            id = obj.getString("id"),
            userId = obj.optString("user_id", ""),
            fullName = obj.optString("full_name", "").ifEmpty { "Doctor" },
            specialty = obj.optString("specialty", ""),
            specializationId = obj.optString("specialization_id", ""),
            licenseNumber = obj.optString("license_number", ""),
            yearsOfExperience = obj.optInt("years_of_experience", 0),
            feeCentavos = obj.optLong("fee_centavos", 0),
            bio = obj.optString("bio", ""),
            location = ClinicLocation(
                building = obj.optString("building", ""),
                floor = obj.optString("floor", ""),
                room = obj.optString("room", ""),
            ),
            languages = emptyList(),
            status = DoctorStatus.valueOf(obj.optString("status", "ACTIVE").uppercase()),
            createdAt = obj.optString("created_at", ""),
            updatedAt = obj.optString("updated_at", ""),
        )
    }

    private fun parseClinicHours(obj: JSONObject): ClinicHours {
        return ClinicHours(
            dayOfWeek = obj.optInt("day_of_week", 0),
            startTime = obj.optString("start_time", ""),
            endTime = obj.optString("end_time", ""),
            isClosed = obj.optBoolean("is_closed", false),
        )
    }

    private fun parseSpecialty(obj: JSONObject): Specialty {
        return Specialty(
            id = obj.getString("id"),
            name = obj.getString("name"),
            description = obj.optString("description", null),
            doctorCount = 0,
        )
    }

    private fun parseAppointment(obj: JSONObject): Appointment {
        return Appointment(
            id = obj.getString("id"),
            patientId = obj.getString("patient_id"),
            doctorId = obj.getString("doctor_id"),
            startsAt = obj.getString("starts_at"),
            durationMinutes = obj.optInt("duration_minutes", 0),
            status = AppointmentStatus.valueOf(obj.optString("status", "BOOKED")),
            reason = obj.optString("reason", ""),
            createdAt = obj.optString("created_at", ""),
            updatedAt = obj.optString("updated_at", ""),
            completedAt = obj.optString("completed_at", null),
            outcome = obj.optString("outcome", null)?.let {
                when (it) {
                    "completed" -> VisitOutcome.COMPLETED
                    "no_show" -> VisitOutcome.NO_SHOW
                    else -> null
                }
            },
        )
    }

    private fun parseMessageThread(obj: JSONObject): MessageThread {
        return MessageThread(
            id = obj.getString("id"),
            patientId = obj.getString("patient_id"),
            doctorId = obj.getString("doctor_id"),
            subject = obj.optString("subject", ""),
            lastMessageAt = obj.optString("last_message_at", ""),
            unreadCount = obj.optInt("unread_count", 0),
            awaitingAction = obj.optBoolean("awaiting_action", false),
        )
    }

    private fun parseMessage(obj: JSONObject): Message {
        return Message(
            id = obj.getString("id"),
            conversationId = obj.getString("conversation_id"),
            authorId = obj.getString("author_id"),
            authorRole = MessageAuthorRole.valueOf(obj.optString("author_role", "PATIENT")),
            body = obj.getString("body"),
            sentAt = obj.getString("sent_at"),
            readAt = obj.optString("read_at", null),
        )
    }

    private fun parseNotification(obj: JSONObject): Notification {
        return Notification(
            id = obj.getString("id"),
            userId = obj.getString("user_id"),
            type = NotificationType.valueOf(obj.optString("type", "SYSTEM")),
            title = obj.getString("title"),
            body = obj.getString("body"),
            data = null,
            isRead = obj.optBoolean("is_read", false),
            createdAt = obj.getString("created_at"),
            readAt = obj.optString("read_at", null),
        )
    }
}
