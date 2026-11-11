# Graph Report - mediqweb  (2026-11-10)

## Corpus Check
- 235 files · ~143,683 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 79 file(s) not represented in the graph (top: .scss 55, (none) 21, .example 1)
- WARNING: 79 of 314 files seen (25%) have no supported extractor and are missing from this graph entirely. It may look complete while representing only part of the codebase.

## Summary
- 1619 nodes · 3700 edges · 101 communities (68 shown, 33 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.85)
- Token cost: 47,178 input · 2,569 output

## Community Hubs (Navigation)
- Doctor Scheduling
- Date Picker UI
- Doctor Schedule Page
- Patient Management
- Shared UI Components
- Admin Session Management
- Angular Configuration
- Patient API Gateway
- Secretary Workflow
- Admin Configuration
- Auth & Password Service
- Admin API Gateway
- Staff Login Auth
- TypeScript Configuration
- Staff Directory Components
- Toast Notifications
- Chart Components
- Generated API Client
- Package Manifest
- Account & Auth Pages
- Password Management
- Secretary Patient Data
- Package Dependencies
- Test Specs
- Secretary API Gateway
- OTP Input UI
- Admin Analytics
- Doctor Test Data
- Secretary Session
- Generated Default API
- App Shell & Layouts
- Secretary Schedules
- Doctor Appointments
- Password Change & Validation
- Layout Tests
- Forgot Password Tests
- Generated API Interface
- Secretary Appointments
- Change Password UI
- Package Dependencies
- Admin Analytics Dashboard
- Forgot Password UI
- Generated API Base
- Secretary Messages
- Secretary Models & Session
- App Bootstrap & Routing
- Dropdown UI
- Admin Analytics Charts
- Admin Shell & Routes
- Doctor Dashboard
- Doctor Gateway & Models
- Change Password Tests
- Secretary Shell & Routes
- Supabase Service
- Doctor Shell & Routes
- Doctor History
- Doctor Schedule Tests
- Admin Mock Data
- Generated TSConfig
- Secretary Appointments Tests
- Secretary Schedules Page
- Pie Chart UI
- Generated Base API
- Secretary Messages Page
- Modal UI
- App TSConfig
- Admin Patient Accounts
- Doctor Appointments Tests
- Doctor Profile
- Secretary Messages Tests
- Secretary Profile
- Table UI
- Spec TSConfig
- Package Scripts
- Staff Login Page
- Doctor Patient Details Tests
- Admin Settings
- Generated TSConfig ESM
- Secretary History Tests
- Vercel Config
- API Constants
- Password Service Tests
- Shell Layouts
- Mock Notice
- Admin UI Components
- Admin Dashboard Pages
- Angular Animations
- Angular Platform Browser
- Axios Dependency
- TSLib Dependency
- Render Build
- Git Push Script
- Brand UI
- Prod Environment
- Vercel Build
- App Root
- Readme
- Generated API Readme
- Doctor Dashboard Page
- Secretary Dashboard Page
- Root Readme

## God Nodes (most connected - your core abstractions)
1. `@angular/core` - 126 edges
2. `@angular/router` - 49 edges
3. `DoctorSchedule` - 46 edges
4. `SecretarySession` - 44 edges
5. `DatePicker` - 38 edges
6. `DoctorSession` - 32 edges
7. `Card` - 32 edges
8. `AccountStatus` - 32 edges
9. `AdminSession` - 29 edges
10. `PasswordManagementService` - 29 edges

## Surprising Connections (you probably didn't know these)
- `ApiAccount` --references--> `AccountStatus`  [EXTRACTED]
  mediqweb-fe/src/app/admin/admin-session.ts → mediqweb-fe/src/app/shared/domain/account-status.ts
- `dayKeyFrom()` --calls--> `dayKey()`  [EXTRACTED]
  mediqweb-fe/src/app/doctor/doctor.mock-data.ts → mediqweb-fe/src/app/doctor/doctor.dates.ts
- `reportWindow()` --calls--> `addDays()`  [EXTRACTED]
  mediqweb-fe/src/app/admin/admin.analytics.ts → mediqweb-fe/src/app/admin/admin.dates.ts
- `reportWindow()` --calls--> `startOfDay()`  [EXTRACTED]
  mediqweb-fe/src/app/admin/admin.analytics.ts → mediqweb-fe/src/app/admin/admin.dates.ts
- `withinWindow()` --calls--> `dayKey()`  [EXTRACTED]
  mediqweb-fe/src/app/admin/admin.analytics.ts → mediqweb-fe/src/app/admin/admin.dates.ts

## Import Cycles
- 2-file cycle: `mediqweb-fe/src/app/shared/components/change-password/change-password.ts -> mediqweb-fe/src/app/shared/components/index.ts -> mediqweb-fe/src/app/shared/components/change-password/change-password.ts`

## Hyperedges (group relationships)
- **Staff Workspace Pattern** — mediqwebfe_src_app_admin_adminshell, mediqwebfe_src_app_doctor_doctorshell, mediqwebfe_src_app_secretary_secretaryshell [EXTRACTED 1.00]
- **API Client Integration** — mediqwebfe_src_app_core_api_generated_readme, mediqwebfe_src_app_core_api_generated_docs_defaultapi, mediqwebfe_src_app_auth_pages_stafflogin_stafflogin [INFERRED 0.90]

## Communities (101 total, 33 thin omitted)

### Community 0 - "Doctor Scheduling"
Cohesion: 0.07
Nodes (40): ageFrom(), blockMinutes(), dayKey(), formatDuration(), isSameDay(), minutesOfDay(), pad(), parseDayKey() (+32 more)

### Community 1 - "Date Picker UI"
Cohesion: 0.07
Nodes (12): DatePicker, DatePickerDay, dayKey(), MONTH_NAMES, pad(), cell(), cells(), host() (+4 more)

### Community 2 - "Doctor Schedule Page"
Cohesion: 0.07
Nodes (5): datedControlId(), describeSessions(), DoctorSchedule, formatTime(), weeklyControlId()

### Community 3 - "Patient Management"
Cohesion: 0.07
Nodes (24): SEVERITY_ITEMS, SEVERITY_LABEL, SEVERITY_TONE, SeverityFilter, STATUS_FILTER_ITEMS, StatusFilter, DoctorPatients, PatientRow (+16 more)

### Community 4 - "Shared UI Components"
Cohesion: 0.09
Nodes (25): AvatarSize, AvatarStatus, STATUS_TOKEN, ButtonSize, ButtonVariant, CardPadding, CardVariant, Patient (+17 more)

### Community 5 - "Admin Session Management"
Cohesion: 0.06
Nodes (6): AuditSeverity, Specialization, AdminSession, AdminAuditLogs, AdminDashboard, AdminSpecializations

### Community 6 - "Angular Configuration"
Cohesion: 0.05
Nodes (41): build, serve, builder, configurations, defaultConfiguration, options, cli, analytics (+33 more)

### Community 7 - "Patient API Gateway"
Cohesion: 0.09
Nodes (18): HttpPatientGateway, toInvoice(), toMedicalRecord(), toNotification(), toPrescription(), toSpecialization(), ApiResponse, CreateAppointmentRequest (+10 more)

### Community 8 - "Secretary Workflow"
Cohesion: 0.10
Nodes (20): HistoryRow, LIVE, STATUS_ITEMS, StatusFilter, ClosedStatus, HistoryRow, OUTCOME_ITEMS, OutcomeFilter (+12 more)

### Community 9 - "Admin Configuration"
Cohesion: 0.11
Nodes (13): STATUS_FILTER_ITEMS, StatusFilter, Choice, RETENTION_PERIODS, SESSION_TIMEOUTS, DURATION_MS, ToastTimer, Button (+5 more)

### Community 10 - "Auth & Password Service"
Cohesion: 0.11
Nodes (22): Step, emailAddress(), CLOCK, describeOtpFailure(), DEV_MOCK_OTP, DEV_MODE, MOCK_PASSWORD_DIRECTORY, OTP_EXPIRY_MS (+14 more)

### Community 11 - "Admin API Gateway"
Cohesion: 0.13
Nodes (14): AuditEntry, StaffAccount, StaffDraft, ApiAccount, toPatientAccount(), toStaffAccount(), HttpAdminGateway, toAppointment() (+6 more)

### Community 12 - "Staff Login Auth"
Cohesion: 0.10
Nodes (7): AuthService, mapProfile(), AuthState, AuthSession, SupabaseProfile, environment, rxjs

### Community 13 - "TypeScript Configuration"
Cohesion: 0.15
Nodes (14): AUTH_GATEWAY, AuthGateway, StaffCredentials, StaffRole, HttpAuthGatewayAdapter, provideRealAuthGateway(), HttpAuthGateway, MOCK_STAFF_ACCOUNTS (+6 more)

### Community 14 - "Staff Directory Components"
Cohesion: 0.07
Nodes (28): angularCompilerOptions, enableI18nLegacyMessageIdFormat, strictDomEventTypes, strictInjectionParameters, strictInputTypes, strictOutputTypes, compileOnSave, compilerOptions (+20 more)

### Community 15 - "Toast Notifications"
Cohesion: 0.07
Nodes (3): StaffDirectory, AdminDoctors, AdminSecretaries

### Community 16 - "Chart Components"
Cohesion: 0.11
Nodes (7): Toast, ToastService, ToastTone, ICON_PATHS, host(), rendered(), Toasts

### Community 17 - "Generated API Client"
Cohesion: 0.17
Nodes (10): BarChart, BarOrientation, canDraw(), ChartHandle, plural(), prefersReducedMotion(), resolveToken(), resolveTokenNumber() (+2 more)

### Community 18 - "Package Manifest"
Cohesion: 0.10
Nodes (20): AuthSession, DefaultApiAppointmentsIdGetRequest, DefaultApiAuthRegisterPostRequest, DefaultApiAuthSignInPostRequest, DefaultApiDoctorsGetRequest, DefaultApiDoctorsIdAvailabilityGetRequest, DefaultApiDoctorsIdGetRequest, DefaultApiDoctorsIdScheduleGetRequest (+12 more)

### Community 19 - "Account & Auth Pages"
Cohesion: 0.09
Nodes (24): author, dependencies, axios@^1.6.1, description, devDependencies, @types/node@12.11.5 - 12.20.42, typescript@^4.0 || ^5.0, axios (+16 more)

### Community 20 - "Password Management"
Cohesion: 0.12
Nodes (7): ActivityRow, AdminAccountDetails, ContactRow, StaffLogin, HttpAuthGateway, toProfile(), UserProfile

### Community 21 - "Secretary Patient Data"
Cohesion: 0.15
Nodes (3): generateNumericCode(), maskEmail(), PasswordManagementService

### Community 22 - "Package Dependencies"
Cohesion: 0.15
Nodes (16): page(), unbookedPatient(), localIso(), minutesOfDay(), atOpen(), minutesAgo(), MOCK_APPOINTMENTS, MOCK_CONVERSATIONS (+8 more)

### Community 23 - "Test Specs"
Cohesion: 0.13
Nodes (21): description, devDependencies, @angular/cli@21.2.25, @angular/compiler-cli@21.2.25, @angular-devkit/build-angular@^21.2.25, eslint@8.57.0, @types/axios@^0.14.0, @types/jasmine@^5.1.0 (+13 more)

### Community 24 - "Secretary API Gateway"
Cohesion: 0.15
Nodes (5): allToasts(), clearToasts(), latestToast(), ReadToast, toasts()

### Community 25 - "OTP Input UI"
Cohesion: 0.16
Nodes (8): HttpSecretaryGateway, toConversationMessage(), toDoctor(), toMessage(), toProfile(), toThread(), Message, MessageThread

### Community 26 - "Admin Analytics"
Cohesion: 0.13
Nodes (6): OTP_LENGTH, OtpInput, sanitise(), field(), Host, type()

### Community 27 - "Doctor Test Data"
Cohesion: 0.28
Nodes (18): CHARTED_STATUSES, registrationSeries(), ReportWindow, addDays(), addMonths(), dayKey(), dayLabel(), dayWindowEndingOn() (+10 more)

### Community 28 - "Secretary Session"
Cohesion: 0.13
Nodes (11): localIso(), at(), dayKeyFrom(), MOCK_APPOINTMENTS, MOCK_DATED_AVAILABILITY, MOCK_DOCTOR_PROFILE, MOCK_PATIENTS, MOCK_SCHEDULE (+3 more)

### Community 30 - "App Shell & Layouts"
Cohesion: 0.18
Nodes (3): DefaultApi, DefaultApiFactory(), DefaultApiFp()

### Community 31 - "Secretary Schedules"
Cohesion: 0.25
Nodes (10): DOCTOR_NAV, SECRETARY_NAV, StaffCrumb, StaffProfile, ICON_PATHS, StaffNav, StaffNavEntry, StaffNavGroup (+2 more)

### Community 32 - "Doctor Appointments"
Cohesion: 0.12
Nodes (7): ROUTES, TestHost, ageFrom(), DAY_NAMES, MOCK_DOCTORS, CLOSED_STATUSES, pinToDeskDay()

### Community 33 - "Password Change & Validation"
Cohesion: 0.18
Nodes (4): Appointment, DoctorAppointments, DoctorDashboard, DoctorPatientDetails

### Community 34 - "Layout Tests"
Cohesion: 0.23
Nodes (12): Step, PasswordFields, CONFIRM_PASSWORD, NEW_PASSWORD, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS, passwordPolicy(), passwordsMatch() (+4 more)

### Community 35 - "Forgot Password Tests"
Cohesion: 0.12
Nodes (8): ADMIN_NAV, DOCTOR, FilledPage, RolePage, ROUTES, STATELESS_NAV, StubPage, StaffLayout

### Community 36 - "Generated API Interface"
Cohesion: 0.21
Nodes (14): build(), button(), click(), dialog(), FakeClock, host(), openAndRequestCode(), page() (+6 more)

### Community 38 - "Change Password UI"
Cohesion: 0.17
Nodes (3): SecretaryAppointments, SecretaryDashboard, Appointment

### Community 40 - "Admin Analytics Dashboard"
Cohesion: 0.12
Nodes (17): dependencies, @angular/common@21.2.25, @angular/compiler@21.2.25, @angular/core@21.2.25, @angular/forms@21.2.25, @angular/localize@21.2.25, @angular/platform-browser-dynamic@21.2.25, @angular/router@21.2.25 (+9 more)

### Community 41 - "Forgot Password UI"
Cohesion: 0.18
Nodes (13): appointmentTrendSeries(), charted(), clinicHeatmap(), doctorWorkload(), REPORT_WINDOW_DAYS, reportWindow(), appointment(), localAt() (+5 more)

### Community 43 - "Secretary Messages"
Cohesion: 0.16
Nodes (13): DefaultApiAxiosParamCreator(), RequiredError, assertParamExists(), createRequestFunction(), DUMMY_BASE_URL, serializeDataIfNeeded(), setApiKeyToObject(), setBasicAuthToObject() (+5 more)

### Community 44 - "Secretary Models & Session"
Cohesion: 0.22
Nodes (14): DayDivider, MessageRow, ThreadRow, dayKey(), dayLabel(), daysBetween(), formatMinutes(), isSameDay() (+6 more)

### Community 45 - "App Bootstrap & Routing"
Cohesion: 0.13
Nodes (11): ConversationSummary, Doctor, PatientSummary, ProfileDraft, SecretaryProfile, BookingDraft, BookingRefusal, byStart() (+3 more)

### Community 46 - "Dropdown UI"
Cohesion: 0.24
Nodes (6): App, AppComponent, appConfig, routes, authGuard(), @angular/router

### Community 48 - "Admin Shell & Routes"
Cohesion: 0.19
Nodes (8): WorkloadBar, ChartBar, heatLevel(), Heatmap, HeatmapCell, HeatmapMatrix, LEGEND, LinePoint

### Community 49 - "Doctor Dashboard"
Cohesion: 0.18
Nodes (5): ADMIN_ROUTES, ADMIN, ADMIN_NAV, AdminShell, ROUTES

### Community 50 - "Doctor Gateway & Models"
Cohesion: 0.19
Nodes (4): HttpDoctorGateway, toDoctor(), Doctor, DoctorDashboard

### Community 51 - "Change Password Tests"
Cohesion: 0.24
Nodes (11): ACCOUNT, button(), click(), dialog(), FakeClock, host(), open(), page() (+3 more)

### Community 52 - "Secretary Shell & Routes"
Cohesion: 0.18
Nodes (5): SECRETARY_ROUTES, SecretaryShell, layout(), navLabels(), ROUTES

### Community 54 - "Doctor Shell & Routes"
Cohesion: 0.20
Nodes (5): DOCTOR_ROUTES, DoctorShell, headingAt(), page(), ROUTES

### Community 55 - "Doctor History"
Cohesion: 0.20
Nodes (5): DoctorHistory, OUTCOME_ITEMS, OutcomeFilter, dates(), page()

### Community 56 - "Doctor Schedule Tests"
Cohesion: 0.26
Nodes (8): nextWeekday(), on(), page(), setDate(), setDatedSession(), setDatedTime(), setSession(), setSessionTime()

### Community 57 - "Admin Mock Data"
Cohesion: 0.27
Nodes (8): MOCK_APPOINTMENTS, MOCK_AUDIT_ENTRIES, MOCK_DOCTORS, MOCK_PATIENTS, MOCK_SECRETARIES, MOCK_SPECIALIZATIONS, Appointment, StaffKind

### Community 58 - "Generated TSConfig"
Cohesion: 0.18
Nodes (10): compilerOptions, declaration, module, moduleResolution, noImplicitAny, outDir, rootDir, target (+2 more)

### Community 59 - "Secretary Appointments Tests"
Cohesion: 0.29
Nodes (8): actionsFor(), button(), host(), openDialogTitle(), page(), rowActions(), text(), MOCK_SECRETARY_PROFILE

### Community 60 - "Secretary Schedules Page"
Cohesion: 0.33
Nodes (3): SecretarySchedules, DoctorSummary, ScheduleDay

### Community 61 - "Pie Chart UI"
Cohesion: 0.33
Nodes (3): canDraw(), PieChart, prefersReducedMotion()

### Community 62 - "Generated Base API"
Cohesion: 0.25
Nodes (3): BaseAPI, Configuration, ConfigurationParameters

### Community 65 - "App TSConfig"
Cohesion: 0.22
Nodes (8): compilerOptions, outDir, types, exclude, extends, files, include, ./tsconfig.json

### Community 67 - "Doctor Appointments Tests"
Cohesion: 0.36
Nodes (4): button(), clickButton(), host(), rowActions()

### Community 69 - "Secretary Messages Tests"
Cohesion: 0.43
Nodes (6): bubbles(), composer(), root(), rows(), text(), type()

### Community 72 - "Spec TSConfig"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, types, exclude, extends, include, ./tsconfig.json

### Community 73 - "Package Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, lint, ng, start, test, watch

### Community 77 - "Generated TSConfig ESM"
Cohesion: 0.33
Nodes (5): compilerOptions, module, outDir, extends, ./tsconfig.json

### Community 79 - "Vercel Config"
Cohesion: 0.40
Nodes (4): buildCommand, installCommand, outputDirectory, routes

### Community 80 - "API Constants"
Cohesion: 0.67
Nodes (3): API_ROUTES, apiBaseUrl(), buildUrl()

### Community 82 - "Shell Layouts"
Cohesion: 0.50
Nodes (4): Admin Shell, Doctor Shell, Secretary Shell, Staff Layout

### Community 84 - "Admin UI Components"
Cohesion: 0.67
Nodes (3): Staff Directory Component, UI Modal Component, UI Table Component

### Community 85 - "Admin Dashboard Pages"
Cohesion: 0.67
Nodes (3): Admin Dashboard, Staff Login Page, DefaultApi

## Knowledge Gaps
- **17 isolated node(s):** `./tsconfig.json`, `./tsconfig.json`, `./tsconfig.json`, `mediqweb`, `MediqappFe` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 575 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@angular/core` connect `Admin Configuration` to `Doctor Scheduling`, `Date Picker UI`, `Patient Management`, `Shared UI Components`, `Admin Session Management`, `Patient API Gateway`, `Secretary Workflow`, `Auth & Password Service`, `Admin API Gateway`, `Staff Login Auth`, `TypeScript Configuration`, `Toast Notifications`, `Chart Components`, `Generated API Client`, `Password Management`, `Package Dependencies`, `Test Specs`, `Secretary API Gateway`, `OTP Input UI`, `Admin Analytics`, `Secretary Session`, `Secretary Schedules`, `Doctor Appointments`, `Layout Tests`, `Forgot Password Tests`, `Generated API Interface`, `Admin Analytics Dashboard`, `Forgot Password UI`, `Secretary Models & Session`, `App Bootstrap & Routing`, `Dropdown UI`, `Admin Shell & Routes`, `Doctor Dashboard`, `Doctor Gateway & Models`, `Change Password Tests`, `Secretary Shell & Routes`, `Doctor Shell & Routes`, `Doctor History`, `Doctor Schedule Tests`, `Admin Mock Data`, `Secretary Appointments Tests`, `Pie Chart UI`, `Doctor Appointments Tests`, `Secretary Messages Tests`, `Doctor Patient Details Tests`, `Secretary History Tests`, `Mock Notice`?**
  _High betweenness centrality (0.305) - this node is a cross-community bridge._
- **What connects `./tsconfig.json`, `./tsconfig.json`, `./tsconfig.json` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Doctor Scheduling` be split into smaller, more focused modules?**
  _Cohesion score 0.07175141242937853 - nodes in this community are weakly interconnected._
- **Why does `DatePicker` connect `Date Picker UI` to `Doctor Scheduling`, `Shared UI Components`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `Date Picker UI` be split into smaller, more focused modules?**
  _Cohesion score 0.07428571428571429 - nodes in this community are weakly interconnected._
- **Why does `PasswordManagementService` connect `Secretary Patient Data` to `Layout Tests`, `Generated API Interface`, `Auth & Password Service`, `TypeScript Configuration`, `Change Password Tests`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `Doctor Schedule Page` be split into smaller, more focused modules?**
  _Cohesion score 0.07397959183673469 - nodes in this community are weakly interconnected._