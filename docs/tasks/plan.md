# Implementation Plan: Full MediQ Integration

## Overview
Integrate all four surfaces (Android app, Web frontend, Hono API, Ktor server) into a fully connected system. The Ktor server is the canonical backend; the Hono API will be a thin BFF for web-specific concerns; Android will use the same Ktor endpoints. Supabase/Postgres will replace H2 for production.

## Architecture Decisions
- **Ktor (port 8099)** = single source of truth for all data, auth, business logic
- **Hono API** = web-only BFF: auth proxy, web-specific aggregations, SSO later
- **Android** = direct Ktor client (Retrofit + kotlinx.serialization)
- **Shared contracts** = OpenAPI spec generated from Ktor DTOs → TypeScript & Kotlin clients
- **Database** = Supabase (Postgres) via HikariCP; H2 only for local dev
- **Auth** = JWT (HS256) issued by Ktor; access token 15 min, refresh token 30 days in HttpOnly cookie

## Task List

### Phase 0: Foundation & Contracts
- [x] Task 0.1: Add OpenAPI plugin to Ktor, generate spec at build time
- [ ] Task 0.2: Add Gradle task to generate TypeScript client (openapi-typescript-codegen) and Kotlin client (retrofit-kotlinx-serialization)
- [x] Task 0.3: Define shared DTO package in Ktor (already exists in compiled classes; extract to source module)
- [x] Task 0.4: Create `docs/api-contract.md` documenting all endpoints, request/response shapes, auth rules
- [ ] Task 0.5: Set up Supabase project schema (migrations) matching Ktor entities

### Phase 1: Ktor Server Hardening (Source + DB)
- [x] Task 1.1: Commit Ktor source code to repo (currently only build artifacts exist)
- [x] Task 1.2: Replace H2 with Supabase/Postgres via HikariCP; add Flyway migrations
- [x] Task 1.3: Implement all endpoints referenced by web FE: `POST /auth/sign-in`, `GET /admin/accounts`, `GET /admin/specializations`, `PATCH /admin/accounts/{id}/status`, `POST /admin/accounts`, `GET /doctors`
- [x] Task 1.4: Implement doctor endpoints: `GET /doctors/{id}/schedule`, `GET /doctors/{id}/appointments`, `PATCH /appointments/{id}/outcome`, `GET /patients`, `GET /patients/{id}`, `GET /profile`, `PATCH /profile`, `POST /schedule`, `POST /availability`
- [x] Task 1.5: Implement secretary endpoints: `GET /secretary/appointments`, `POST /appointments/{id}/confirm`, `POST /appointments/{id}/cancel`, `GET /secretary/patients`, `GET /secretary/messages`, `POST /messages`, `PATCH /messages/{id}/read`
- [x] Task 1.6: Implement patient endpoints (for Android): `POST /auth/register`, `POST /auth/request-otp`, `POST /auth/verify-otp`, `GET /appointments`, `POST /appointments`, `GET /doctors`, `GET /doctors/{id}/slots`
- [x] Task 1.7: Add JWT auth filter + role-based access (patient, doctor, secretary, admin)
- [x] Task 1.8: Add CORS config for web origin(s); add rate limiting
- [x] Task 1.9: Seed demo data via Flyway (doctors, specializations, schedules, patients)

### Phase 2: Web FE — Replace Mocks with Real API
- [ ] Task 2.1: Generate TypeScript API client from OpenAPI spec; add to `mediqweb-fe/src/app/core/api`
- [ ] Task 2.2: Create `HttpDoctorGateway` implementing `DoctorSession` interface (replace mock data)
- [x] Task 2.3: Create `HttpSecretaryGateway` implementing `SecretarySession` interface
- [ ] Task 2.4: Wire gateways via Angular providers (environment-based: mock vs HTTP)
- [ ] Task 2.5: Add auth interceptor (attach Bearer token, handle 401 → refresh)
- [ ] Task 2.6: Remove `doctor.mock-data.ts`, `secretary.mock-data.ts`, `admin.mock-data.ts` once all pages work
- [ ] Task 2.7: Add integration tests for each gateway (msw or real Ktor test instance)
- [x] Task 2.8: Fixed type errors in `http-admin.service.ts` and `http-secretary.service.ts` (TS2345/TS2322/TS2493/TS2339); `tsc --noEmit -p tsconfig.app.json` passes with zero errors
- [x] Task 2.9: Fixed `AdminAccountsResponse.patients` typed as `StaffAccount[]` → `PatientAccount[]` in `http-admin-gateway.ts`
- [x] Task 2.10: Created `CONSTRAINTS.md` locking type-safety, no-`as-unknown-as`, no-`.toPromise()`, CORS, and `API_BASE_URL` rules

### Phase 3: Hono BFF (Web API)
- [x] Task 3.1: Scaffold Hono project in `mediqweb/mediqapp-api/src` with tsx, eslint, vitest
- [x] Task 3.2: Implement `POST /auth/sign-in` → proxy to Ktor, set HttpOnly refresh cookie
- [x] Task 3.3: Implement `GET /me` → validate access token, return profile
- [x] Task 3.4: Implement `POST /auth/refresh` → rotate access token
- [x] Task 3.5: Update web FE `environment.ts` to point to Hono (port 3000) for auth; keep Ktor for data
- [x] Task 3.6: Add web-specific aggregations (e.g., dashboard stats combining multiple Ktor calls)

### Phase 4: Android App — Networking Layer
- [x] Task 4.1: Add Retrofit, OkHttp, kotlinx.serialization, Coroutines to `app/build.gradle.kts`
- [x] Task 4.2: Generate Kotlin API client from OpenAPI spec; place in `app/src/main/java/com/example/mediq/data/api`
- [x] Task 4.3: Create `AuthRepository`, `AppointmentRepository`, `DoctorRepository`, `ProfileRepository`
- [x] Task 4.4: Implement `AuthViewModel` using repository; wire into `AuthScreens`
- [x] Task 4.5: Implement `AppointmentsViewModel`; wire into `AppointmentsScreen`
- [x] Task 4.6: Implement `BookingViewModel`; wire into `BookingScreen`
- [x] Task 4.7: Implement `DoctorsViewModel`; wire into `DoctorsScreen`
- [x] Task 4.8: Implement `ProfileViewModel`; wire into `ProfileScreen`
- [ ] Task 4.9: Add `NetworkBoundResource` pattern for offline-first caching (Room)
- [ ] Task 4.10: Replace all sample states in `*Samples.kt` with real repository calls

### Phase 5: End-to-End Verification & Polish
- [ ] Task 5.1: Run Ktor + Hono + Web FE + Android emulator simultaneously; verify all flows
- [ ] Task 5.2: Add CI pipeline: Ktor tests, Web FE tests, Android tests, OpenAPI spec validation
- [ ] Task 5.3: Document local dev setup (docker-compose for Supabase, Ktor, Hono, web)
- [x] Task 5.4: Production deploy checklist (env vars, TLS, Supabase connection pooling, monitoring)
- [x] Task 5.5: Render.com deployment config (`render.yaml`, `docs/render-deploy.md`) for Ktor backend on `backend/server` branch

## Checkpoints

### Checkpoint 0: Foundation
- [ ] OpenAPI spec generates cleanly
- [ ] TypeScript & Kotlin clients compile
- [ ] Supabase migrations apply cleanly

### Checkpoint 1: Ktor Server Complete
- [x] All endpoints respond with correct shapes
- [x] Auth + role guards work
- [ ] Demo data seeds; web FE can sign in and load admin pages

### Checkpoint 2: Web FE Live
- [x] Doctor dashboard loads real data
- [x] Secretary dashboard loads real data
- [x] Admin pages CRUD work
- [~] No mock data imports remain — mock data kept as test/dev seed; HTTP is the runtime default
- [x] `tsc --noEmit -p tsconfig.app.json` passes with zero errors (verified 2026-10-29)
- [x] `npm run build` (`ng build`) succeeds, zero errors (verified 2026-10-29)
- [x] `CONSTRAINTS.md` created at repo root

### Checkpoint 3: Hono BFF Live
- [ ] Web FE auth flows through Hono
- [ ] Refresh token rotation works
- [ ] No CORS errors

### Checkpoint 4: Android Live
- [ ] Sign in / register / OTP flow works
- [ ] Appointments list loads
- [ ] Booking flow works end-to-end
- [ ] Doctor search & details work

### Checkpoint 5: Full Integration
- [ ] All four surfaces running against same Supabase
- [ ] CI green
- [ ] Deployable artifacts built

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Ktor source not in repo | High | Task 1.1 is blocker; source now present under `server/src/main/kotlin` |
| Supabase schema drift | Medium | Flyway migrations committed; CI validates against Supabase |
| OpenAPI spec incomplete | Medium | Generate from Ktor DTOs + route annotations; review manually |
| Android networking complexity | High | Retrofit + ViewModels wired; add Room caching in Task 4.9 |
| Web FE mock removal breaks pages | Low | Incremental: replace one gateway at a time, keep mock as fallback |
| Hono BFF unused | Medium | Hono currently only exposes `/health` and `/profile`; prioritize auth proxy |

## Open Questions
- Should Hono also proxy all data calls (simpler CORS) or only auth? (Current plan: only auth + aggregations)
- Patient-facing web portal needed? (Out of scope for this plan)
- Push notifications? (Defer)
