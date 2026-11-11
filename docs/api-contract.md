# MediQ API Contract

## Base URL
- Local: `http://localhost:8099`
- Production: `https://api.mediq.app`

## Authentication
All authenticated endpoints require `Authorization: Bearer <token>` header.

### POST /auth/sign-in
Request: `{ username: string, password: string }`
Response: `{ accessToken: string, expiresAt: string, refreshToken: string, refreshExpiresAt: string, profile: UserProfile }`

### POST /auth/register
Request: `{ username, password, fullName, email?, mobileNumber, dateOfBirth, role }`
Response: AuthSession

### POST /auth/request-otp
Request: `{ contact: string, purpose: "register" | "reset_password" }`
Response: `{}`

### POST /auth/verify-otp
Request: `{ contact, code, purpose }`
Response: AuthSession

### POST /auth/refresh
Request: `{}` (token in Authorization header)
Response: AuthSession

## User Profile

### GET /profile
Response: UserProfile

### PATCH /profile
Request: `{ name?, email?, mobileNumber? }`
Response: UserProfile

## Doctors

### GET /doctors
Query: `?specializationId=&search=&status=&limit=&offset=`
- `limit` clamped to 1–100 (default 20); `offset` floored at 0 (default 0).
Response: Paged<Doctor>

### GET /doctors/{id}
Response: Doctor

### GET /doctors/{id}/schedule
Response: ClinicHours[]

### POST /doctors/{id}/schedule
Request: ClinicHours[]
Response: 200 OK

### GET /doctors/{id}/availability
Query: `?date=YYYY-MM-DD`
Response: AvailableDate[]

### POST /doctors/{id}/availability
Request: AvailableDate
Response: 200 OK

### GET /doctors/{id}/appointments
Query: `?from=&to=`
Response: Appointment[]

### PATCH /doctors/appointments/{appointmentId}/outcome
Request: VisitOutcome ("completed" | "no_show")
Response: Appointment

## Specializations

### GET /specializations
Response: Specialty[]

### POST /specializations
Request: Specialty
Response: Specialty (admin only)

### PUT /specializations/{id}
Request: Specialty
Response: Specialty (admin only)

### DELETE /specializations/{id}
Response: 200 OK (admin only)

## Appointments

### GET /appointments
Query: `?status=&from=&to=&limit=&offset=`
Response: Paged<Appointment>

### POST /appointments
Request: BookingRequest (`doctorId`, `startsAt`, `durationMinutes`, `reason` — no `patientId`; the server assigns the authenticated patient's `userId`)
Response: Appointment (patient only)

### GET /appointments/{id}
Response: Appointment

## Messages

### GET /messages/conversations
Response: MessageThread[]

### GET /messages/conversations/{id}
Response: MessageThread

### GET /messages/conversations/{id}/messages
Response: Message[]

### POST /messages/conversations/{id}/messages
Request: string (body)
Response: Message

### PATCH /messages/conversations/{id}/read
Response: 200 OK

## Notifications

### GET /notifications
Query: `?unread=true`
Response: Notification[]

### PATCH /notifications/{id}/read
Response: 200 OK

### POST /notifications/read-all
Response: 200 OK

## Admin

### GET /admin/accounts
Response: AdminAccountsResponse

### POST /admin/accounts?kind=doctor|secretary
Request: StaffDraft
Response: UserProfile

### PATCH /admin/accounts/{id}/status
Request: AccountStatus
Response: UserProfile

### GET /admin/doctors
Response: Doctor[]

### GET /admin/appointments
Query: `?doctorId=&patientId=&status=&from=&to=&limit=&offset=`
- `limit` clamped to 1–500 (default 50); `offset` floored at 0 (default 0).
- `status` must be one of: booked, confirmed, completed, cancelled, no_show (case-insensitive); invalid value returns 400 VALIDATION_ERROR.
Response: Paged<Appointment> (admin only)

## Secretary

### GET /secretary/appointments
Response: Appointment[]

### POST /secretary/appointments/{id}/confirm
Response: 200 OK

### POST /secretary/appointments/{id}/cancel
Response: 200 OK

### GET /secretary/patients
Response: UserProfile[]

### GET /secretary/messages
Response: MessageThread[]

## Health

### GET /health
Response: { status: "ok" }

---

## Web API Implementation Status (`mediqweb/mediqapp-api/`)

The Hono web API is a minimal surface. Current state:

| Contract Section | Endpoints | Implemented in Hono web API? |
|---|---|---|
| Authentication | sign-in, register, request-otp, verify-otp, refresh | No |
| User Profile | GET/PATCH /profile | GET only |
| Doctors | list/get/schedule/availability/appointments/outcome | No |
| Specializations | CRUD | No |
| Appointments | list/create/get | No |
| Messages | conversations/messages/read | No |
| Notifications | list/read/read-all | No |
| Admin | accounts/doctors/status | No |
| Secretary | appointments/confirm/cancel/patients/messages | No |
| Health | /health | Yes |

Implemented routes in `mediqweb/mediqapp-api/src/index.ts`: `GET /health`, `GET /profile` only. Supabase middleware (`src/supabase.ts`) is wired globally but only `/profile` consumes `c.var.supabaseContext`.

The Ktor server (`server/`) implements the full contract per `http/Routes.kt` and is the canonical API for the Android app (base `http://127.0.0.1:8099`). The web frontend has no HTTP client wired (`provideHttpClient()` absent from `app.config.ts`), no route guards, and mocked auth/session layers — see `docs/system-current-condition.md` section 2.