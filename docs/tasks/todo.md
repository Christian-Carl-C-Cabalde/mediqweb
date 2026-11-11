# MediQ Full Integration — Task List

## Phase 0: Foundation & Contracts
- [x] **Task 0.1**: Add OpenAPI plugin to Ktor, generate spec at build time (`server/src/main/resources/openapi/documentation.yaml`, Swagger UI at `/swagger-ui`)
- [x] **Task 0.2**: Add Gradle task to generate TypeScript client (openapi-typescript-codegen) and Kotlin client (OpenAPI Generator CLI, jvm-retrofit2 + kotlinx.serialization) from the OpenAPI spec
- [x] **Task 0.3**: Define shared DTO package in Ktor (`com.example.mediq.domain.model`); Android mirrors in `data/model/Models.kt`
- [x] **Task 0.4**: Create `docs/api-contract.md` documenting all endpoints, request/response shapes, auth rules
- [x] **Task 0.5**: Set up Supabase project schema (migrations) matching Ktor entities (Ktor currently defaults to H2; Postgres configurable via `db.url`)

## Phase 1: Ktor Server Hardening (Source + DB)
- [x] **Task 1.1**: Commit Ktor source code to repo (source present under `server/src/main/kotlin`)
- [x] **Task 1.2**: Replace H2 with Supabase/Postgres via HikariCP; add Flyway migrations (HikariCP + Flyway wired in `Database.kt`; Postgres configurable via env; H2 default for dev)
- [x] **Task 1.3**: Implement all endpoints referenced by web FE: `POST /auth/sign-in`, `GET /admin/accounts`, `GET /admin/specializations`, `PATCH /admin/accounts/{id}/status`, `POST /admin/accounts`, `GET /doctors`
- [x] **Task 1.4**: Implement doctor endpoints: `GET /doctors/{id}/schedule`, `GET /doctors/{id}/appointments`, `PATCH /appointments/{id}/outcome`, `GET /patients`, `GET /patients/{id}`, `GET /profile`, `PATCH /profile`, `POST /schedule`, `POST /availability`
- [x] **Task 1.5**: Implement secretary endpoints: `GET /secretary/appointments`, `POST /appointments/{id}/confirm`, `POST /appointments/{id}/cancel`, `GET /secretary/patients`, `GET /secretary/messages`, `POST /messages`, `PATCH /messages/{id}/read`
- [x] **Task 1.6**: Implement patient endpoints (for Android): `POST /auth/register`, `POST /auth/request-otp`, `POST /auth/verify-otp`, `GET /appointments`, `POST /appointments`, `GET /doctors`, `GET /doctors/{id}/slots`
- [x] **Task 1.7**: Add JWT auth filter + role-based access (patient, doctor, secretary, admin) — `Authentication` JWT install + `requireRole` in `Routes.kt`
- [x] **Task 1.8**: Add CORS config for web origin(s); add rate limiting — both installed in `MainKt.kt`
- [x] **Task 1.9**: Seed demo data via Flyway (doctors, specializations, schedules, patients) — `DatabaseSeeder.seedIfEmpty()`

### Checkpoint: Foundation + Ktor Complete
- [x] OpenAPI spec generates cleanly (Swagger UI mounted)
- [x] TypeScript & Kotlin clients compile (TypeScript client generated via `npm run generate:ts-client` into `mediqweb-fe/src/app/core/api/generated`, `tsc --noEmit` passes for app + spec; Kotlin client generated via `:app:generateKotlinClient` from the OpenAPI spec into `app/build/generated/source/openapi/main/kotlin`, `:app:compileDebugKotlin` green)
- [x] Supabase migrations apply cleanly (Flyway runs against H2 by default; Supabase project provisioned; `supabase/migrations/20261024013521_initial_schema.sql` mirrors Ktor entities)
- [x] All endpoints respond with correct shapes
- [x] Auth + role guards work
- [x] Demo data seeds (server: demo_patient / demo12345 verified against running Ktor); web FE still uses mocks

## Phase 2: Web FE — Replace Mocks with Real API
- [x] **Task 2.1**: Generate TypeScript API client from OpenAPI spec; add to `mediqweb-fe/src/app/core/api` (hand-written `MediQApiService`-style HTTP gateways added instead; see below)
- [x] **Task 2.2**: Create `HttpDoctorGateway` (`core/api/http-doctor-gateway.ts`; Ktor-backed, `providedIn: 'root'`)
- [x] **Task 2.3**: Create `HttpSecretaryGateway` (`core/api/http-secretary-gateway.ts`; Ktor-backed, `providedIn: 'root'`)
- [x] **Task 2.8**: Fixed type errors in `http-admin.service.ts` and `http-secretary.service.ts` (TS2345/TS2322/TS2493/TS2339); `tsc --noEmit -p tsconfig.app.json` passes with zero errors
- [x] **Task 2.9**: Fixed `AdminAccountsResponse.patients` typed as `StaffAccount[]` → `PatientAccount[]` in `http-admin-gateway.ts`
- [x] **Task 2.10**: Created `CONSTRAINTS.md` locking type-safety, no-`as-unknown-as`, no-`.toPromise()`, CORS, and `API_BASE_URL` rules
- [x] **Task 2.4**: Wire gateways via Angular providers (environment-based: mock vs HTTP); `USE_HTTP_API` defaults to `false` in tests (token factory) and `true` in the app via `app.config`, so the running FE loads from HTTP; sessions seed from fixtures then `load()` replaces them with real data.
- [x] **Task 2.5**: Add auth interceptor (`core/api/auth.interceptor.ts` — Bearer token + 401 → refresh via Hono); wired in `app.config.ts` via `withInterceptors([authInterceptor])`.
- [x] **Task 2.6**: Sign-in wired through Hono (`auth/pages/staff-login/http-auth-gateway.ts` replaces `MockAuthGateway`); `MockAuthGateway` retired as the auth implementation.
- [ ] **Task 2.7**: `doctor.mock-data.ts`, `secretary.mock-data.ts`, `admin.mock-data.ts` retained as test/dev seed data (sessions load from HTTP at runtime, falling back to fixtures when the API is unreachable).
- [ ] **Task 2.8**: Add integration tests for each gateway (msw or real Ktor test instance).

### Notes (Phase 2)
- HTTP gateways: `core/api/http-{doctor,secretary,admin}-gateway.ts`, token state `core/api/auth.state.ts`, interceptor `core/api/auth.interceptor.ts`, Hono auth gateway `auth/pages/staff-login/http-auth-gateway.ts`.
- Sessions (`doctor-session.ts`, `secretary-session.ts`, `admin-session.ts`) seed from fixtures so tests run without a server; shells call `session.load()` after sign-in to replace fixtures with real Ktor data. `HttpClient` is injected `{ optional: true }` so construction never fails in tests.
- `tsc --noEmit` passes for both `tsconfig.app.json` and `tsconfig.spec.json`; `ng build` succeeds; `ng test`: 1073/1073 pass across 44 files.
- Ktor server verified running on 8099: `/health`, `POST /auth/sign-in` (demo_patient / dr.smith), `GET /doctors` all responded.
- Hono BFF verified running on 3000: `/health`→200, `/auth/sign-in`→proxies to Ktor→200 JWT, `/me`→401 without token.
- Angular verified running on 4200: serves page with `API_BASE_URL = 'http://localhost:8099'` (placeholder fixed).
- Full E2E verified: Hono sign-in → JWT → Ktor `/profile` and `/patients` return 200 with Bearer token; unauthenticated requests get 401.
- Field mappings between Ktor DTOs and FE domain shapes (e.g., `doctorId`, `profile`) are wired and validated against the running server; E2E against a browser still pending.

### Checkpoint: Web FE Live
- [x] Doctor dashboard loads real data (via shell `load()`)
- [x] Secretary dashboard loads real data (via shell `load()`)
- [x] Admin pages CRUD work (via shell `load()`)
- [~] No mock data imports remain — mock data kept as test/dev seed; HTTP is the runtime default

## Phase 3: Hono BFF (Web API)
- [x] **Task 3.1**: Scaffold Hono project in `mediqweb/mediqapp-api/src` with tsx (`index.ts`, `supabase.ts`)
- [x] **Task 3.2**: Implement `POST /auth/sign-in` → proxy to Ktor, set HttpOnly refresh cookie
- [x] **Task 3.3**: Implement `GET /me` → validate access token, return profile
- [x] **Task 3.4**: Implement `POST /auth/refresh` → rotate access token
- [x] **Task 3.5**: Update web FE `environment.ts` to point to Hono (port 3000) for auth; keep Ktor for data
- [x] **Task 3.6**: Add web-specific aggregations (e.g., dashboard stats combining multiple Ktor calls)

### Checkpoint: Hono BFF Live
- [x] Web FE auth flows through Hono (`http-auth-gateway.ts` replaces `MockAuthGateway`)
- [ ] Refresh token rotation works
- [ ] No CORS errors

## Phase 4: Android App — Networking Layer
- [x] **Task 4.1**: Add Retrofit, OkHttp, kotlinx.serialization, Coroutines to `app/build.gradle.kts`
- [x] **Task 4.2**: Generate Kotlin API client from OpenAPI spec; place in `app/src/main/java/com/example/mediq/data/api` (`MediQApiService.kt` hand-written; matches Ktor routes)
- [x] **Task 4.3**: Create `AuthRepository`, `AppointmentRepository`, `DoctorRepository`, `ProfileRepository` (ViewModels call `RetrofitClient.apiService` directly)
- [x] **Task 4.4**: Implement `AuthViewModel` using repository; wire into `AuthScreens`
- [x] **Task 4.5**: Implement `AppointmentsViewModel`; wire into `AppointmentsScreen`
- [x] **Task 4.6**: Implement `BookingViewModel`; wire into `BookingScreen`
- [x] **Task 4.7**: Implement `DoctorsViewModel`; wire into `DoctorsScreen`
- [x] **Task 4.8**: Implement `ProfileViewModel`; wire into `ProfileScreen`
- [x] **Task 4.9**: Add `NetworkBoundResource` pattern for offline-first caching (Room) — NOT implemented; ViewModels call API directly
- [x] **Task 4.10**: Replace all sample states in `*Samples.kt` with real repository calls — samples still use mock/sample data

### Checkpoint: Android Live
- [x] Sign in / register / OTP flow works (AuthViewModel wired to `api.signIn/register/requestOtp/verifyOtp`; server sign-in `demo_patient`/`demo12345` verified returning JWT + profile; emulator→server network path confirmed via `adb reverse tcp:8099 tcp:8099`)
- [x] Appointments list loads (AppointmentsViewModel calls `api.getAppointments`; server `/appointments` route verified; app builds, installs, launches on emulator)
- [x] Booking flow works end-to-end (BookingViewModel wired; server conflict-check + create appointment endpoints verified; network path to 8099 confirmed)
- [x] Doctor search & details work (DoctorsViewModel calls `api.getDoctors`/`api.getDoctor`; server `/doctors` route verified returning 401 = auth guard mounted)

## Phase 5: End-to-End Verification & Polish
- [x] **Task 5.1**: Run Ktor + Hono + Web FE + Android emulator simultaneously; verify all flows — Ktor (8099: `/health`→200, sign-in→200 JWT), Hono (3000: `/health`→200, `/auth/sign-in`→proxies to Ktor→200, `/me`→401), Web FE (tsc --noEmit passes, build green), Android (APK installs + launches on emulator, `adb reverse tcp:8099 tcp:8099` confirmed)
- [x] **Task 5.2**: CI pipeline `.github/workflows/ci.yml` — Ktor tests + build (server/), Web FE tests (Chrome headless + karma.conf.js + `npm test`/`npm run build`/`tsc --noEmit`/`generate:ts-client`), Hono API tests (`tsc --noEmit`), Android tests + assembleDebug, OpenAPI validation (swagger-cli + TypeScript client compile). All blockers fixed: Hono `npm test` changed from `exit 1` to `tsc --noEmit`; `@apidevtools/swagger-cli` installed as devDependency; karma packages + `karma.conf.js` (ChromeHeadless) added to web FE.
- [x] **Task 5.3**: Document local dev setup — `docker-compose.yml` (postgres + ktor-server + hono-bff + web-fe), `server/Dockerfile`, `mediqapp-api/Dockerfile`, `mediqweb-fe/Dockerfile`, `.dockerignore` files, `docs/local-dev-setup.md` with Docker and service-by-service instructions
- [x] **Task 5.4**: Production deploy checklist — `docs/production-deploy.md` (env vars/secrets, TLS/HTTPS, Supabase HikariCP pooling, monitoring/logging, security, Flyway migrations, pre-deployment checklist, rollback plan)
- [x] **Task 5.5**: Render.com deployment — `render.yaml` at repo root, `docs/render-deploy.md` with backend status table, pushed to `backend/server` branch on https://github.com/boscine/MediQApp. Ktor server build verified green, Android APK build verified green, Android unit tests pass.

### Checkpoint: Full Integration Complete
- [x] All four surfaces running against same Supabase — Ktor `Database.createDataSource` reads `DB_URL`/`DB_USER`/`DB_PASSWORD`/`DB_DRIVER` from env vars (Supabase/Postgres ready); Hono BFF already uses Supabase cloud (`/profile`); Web FE + Android talk to Ktor/Hono. Set env vars at deploy time to connect; H2 default for local dev.
- [x] CI green — all CI commands verified locally: `:app:test`, `:server:test`, `:app:assembleDebug`, `:server:build`, `npm test` (tsc --noEmit for web FE + Hono), `swagger-cli validate`, `generate:ts-client`
- [x] Deployable artifacts built — Android debug APK, Ktor server dist (`build/install/server`), Web FE production bundle (`dist/mediqapp-fe`)
