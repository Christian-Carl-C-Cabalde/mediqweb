# MediQ System Current Condition

Generated: 2026-10-24

This summary reflects the live repository state (commits, file layout, code, and build attempts). Docs in `docs/` appear partially stale relative to the implemented API/structure; this is a consolidated current-condition reference.

## 1) Android App (`app/`)
- **Tech**: Kotlin 2.2.10, Jetpack Compose, Material 3, Navigation Compose, minSdk 24, compile/targetSdk 37, Java 11. AGP 9.2.1.
- **Entry**: `app/src/main/java/com/example/mediq/MainActivity.kt` — restores session via `MediQSession`, sets `RetrofitClient.accessToken`, shows toast of restored user, determines start destination (Home if session else SignIn), enables edge-to-edge, hosts `MediQNavHost` inside `Scaffold` with bottom bar shown for main tabs.
- **Networking**: `data/api/RetrofitClient.kt` uses base `http://127.0.0.1:8099/` (requires `adb reverse tcp:8099 tcp:8099` to reach server). OkHttp with auth interceptor adding `Authorization: Bearer` from `RetrofitClient.accessToken`, logging interceptor (BODY). JSON uses kotlinx.serialization with `ignoreUnknownKeys=true`, `isLenient=true`, `encodeDefaults=true`. `MediQApiService.kt` defines endpoints.
- **Models**: `data/model/Models.kt` contains full domain models/enums matching API contract (UserProfile, Doctor, Appointment, Message, Notification, etc., with @SerialName mappings).
- **UI**: Token-driven design system under `ui/theme/` (Color, Type, Spacing, Shape). Components in `ui/components/`. Navigation in `ui/navigation/`. Screens organized by feature under `ui/screens/` following pattern `*Screen.kt`, `*UiState.kt`, `*States.kt`, `*Previews.kt`, `*Samples.kt`. ViewModels under `ui/viewmodel/`. Design contract in `docs/design-contract.md` (referenced).
- **Session**: `ui/session/MediQSession.kt`, `ui/session/DisplayName.kt`.
- **Build state**: `./gradlew :app:assembleDebug` runs green from repo root (Gradle wrapper restored at root). Android dependencies include Retrofit/OkHttp/kotlinx.serialization/coroutines and Compose BOM. `:app:generateKotlinClient` runs the OpenAPI Generator CLI against `server/src/main/resources/openapi/documentation.yaml` into `app/build/generated/source/openapi/main/kotlin`; `:app:compileDebugKotlin` is green. APK installs and launches on an emulator; `adb reverse tcp:8099 tcp:8099` confirms the emulator→server network path.
- **Notes**: UI follows strict token-only styling per AGENTS. MainActivity shows session restoration toast (dev feedback).

## 2) Web App
### Frontend (`mediqweb/mediqweb-fe/`)
- **Tech**: Angular 21, TypeScript 5.9, RxJS, Chart.js. Standalone components. Prettier configured.
- **Structure**: Large role-based app under `src/app/` with `admin/`, `doctor/`, `secretary/`, `auth/`, `shared/`, `core/`. Routes in `app.routes.ts`: `/login` (StaffLogin), redirects `/`->`/login`, lazy-loaded `admin/doctor/secretary` routes, fallback to `/login`.
- **Features**: Dashboards, appointments, patients, schedules, messages, profiles, settings, specializations, analytics/charts (Chart.js), shared UI components (buttons, cards, tables, modals, forms, toasts, charts), validation, services, mocks for some data.
- **Build**: `npm run build` (ng build). Node/npm versions per packageManager `npm@11.6.2`.
- **Wiring gaps** (no backend integration yet):
  - `app.config.ts:7` provides only `provideBrowserGlobalErrorListeners()` + `provideRouter(routes)`. **No `provideHttpClient()`**, no API base URL token, no auth interceptor — HTTP calls cannot be made from anywhere.
  - No `environment.ts` / `environment.prod.ts` files exist under `src`; no API base URL configured.
  - **No route guards** — `/admin`, `/doctor`, `/secretary` are openly reachable without signing in. Angular skips resolvers when no guard exists on the tree (`doctor.routes.ts:12-15`).
  - **Auth gateway is mocked**: `staff-login.ts:34` provides `MockAuthGateway` with hardcoded accounts (`admin`/`doctor`/`secretary`, password `123123`) in `mock-auth.gateway.ts:29-32`. No real HTTP auth implementation exists.
  - **All area sessions are in-memory mocks**: `AdminSession` (`admin-session.ts`), `DoctorSession` (`doctor-session.ts`), `SecretarySession` (`secretary-session.ts`) are `@Injectable()` backed by local mock-data fixtures. Each docstring states replacing them with an API-backed service is the only change screens need. None are wired to any backend.
  - `ToastService` (`toast.service.ts:80`) is `providedIn: 'root'` but has no HTTP error interceptor to surface API failures as toasts.

### Web API (`mediqweb/mediqapp-api/`)
- **Tech**: Hono 4.13.10 on Node, TypeScript 7, tsx for dev, `@supabase/server`, `@hono/node-server`.
- **Entry**: `src/index.ts` — creates Hono app with `supabaseMiddleware`, has `/health` returning `{status:"ok"}`, and `/profile` querying Supabase `profiles` table.
- **Config**: `.env.example` present. Uses ESM (`"type":"module"`).
- **Wiring gaps**:
  - Only two routes exposed (`/health`, `/profile`). No endpoints for appointments, accounts, patients, doctors, schedules, messages, notifications, or password reset.
  - `supabase.ts:10-12` configures `withSupabase({ auth: "user" })`, but only `/profile` reads `c.var.supabaseContext`. Middleware is wired but underused.
  - Frontend has no Supabase client integration at all.
  - Minimal API layer. Much of the business API appears to be served by the Ktor server (`server/`) rather than this Hono API; both exist as separate surfaces.

## 3) Server (`server/`)
- **Tech**: Ktor 3.2.3, Kotlin/JVM, Netty, kotlinx.serialization, JWT (java-jwt), BCrypt, HikariCP, Flyway, H2/Postgres, OpenAPI/Swagger. Java 17 toolchain. Port 8099 by default.
- **Entry**: `server/src/main/kotlin/com/example/mediq/server/MainKt.kt` — wires services/repos, installs ContentNegotiation (JSON), StatusPages (ApiFailure envelopes), CallLogging, CORS (from config/env), RateLimit (global 100/min), JWT auth (`bearer`), registers routes, mounts Swagger UI at `/swagger-ui` from `openapi/documentation.yaml`, exposes `/health`.
- **Routes**: `http/Routes.kt` implements full API per `docs/api-contract.md`:
  - Auth: sign-in/register/request-otp/verify-otp/refresh, password update (authenticated)
  - Profile: GET/PATCH
  - Doctors: list/get/schedule/appointments/availability; schedule/availability management (doctor/admin)
  - Specializations: CRUD (admin)
  - Patients: list/get (role-aware)
  - Appointments: list/create/get with role filtering, conflict check
  - Messages: conversations/messages/send/read
  - Notifications: list/read/read-all
  - Admin: accounts/specializations/create staff/update status/doctors
  - Secretary: appointments/confirm/cancel/patients/messages
- **MCP**: `mcp/McpServer.kt` registers MCP streamable HTTP endpoint `POST /mcp` (JSON-RPC 2.0) protected by bearer auth with tools `mediq_message` and `mediq_db_query` (stubs). JSON deserialization is strict (`ignoreUnknownKeys=false`, `isLenient=false`) so malformed JSON-RPC input fails fast instead of being silently accepted.
- **Data**: Flyway migrations present (`resources/db/migration/V1__initial_schema.sql`); `Database.createDataSource` runs migrations at startup. H2 is the dev default; Postgres (incl. Supabase) configurable via `db.url`. Supabase schema mirrored in `supabase/migrations/20261024013521_initial_schema.sql`.
- **Build**: Standalone Gradle project in `server/`. Background build started earlier (`gradlew.bat build`). Tests configured with JUnit5.
- **Notes**: Server is the primary API for Android app (base URL 127.0.0.1:8099). Demo account mentioned in AGENTS: `demo_patient` / `demo12345`.

## 4) Shared/Infra
- **API Contract**: `docs/api-contract.md` documents endpoints/DTOs (matches server routes).
- **Design Contract**: `docs/design-contract.md` governs Android UI (token-only, increment order, boundaries).
- **Project Map**: `docs/project-map.md` describes structure.
- **Supabase**: `supabase/` exists; web API uses Supabase client. Android/Ktor appear to use in-memory repos primarily.
- **DB migrations**: Server has Flyway migrations under `server/src/main/resources/db/migration/`.
- **OpenAPI**: `server/src/main/resources/openapi/documentation.yaml` served by Swagger UI.
- **Git**: On branch (not shown), recent commits show UI refactors; modified files include `mediqweb` (submodule/dir), `server/src/main/kotlin/com/example/mediq/http/Routes.kt`. Untracked: `.kilo/`, `mcp_tail.txt`, `server/logs/`, `server/src/main/kotlin/com/example/mediq/mcp/`.

## 5) Current Build Status
- **Android**: `gradlew.bat` restored at root. `:app:assembleDebug` green; `:app:compileDebugKotlin` green (incl. generated OpenAPI client). APK installed and launched on emulator; emulator→`127.0.0.1:8099` reachable via `adb reverse tcp:8099 tcp:8099`.
- **Server**: `gradlew.bat build -x test` green in `server/`; Ktor running on port 8099: `/health` → 200, sign-in `demo_patient`/`demo12345` → 200 JWT, `/doctors` → 401 (auth guard mounted).
- **Web FE**: `npm run generate:ts-client` produces `mediqweb-fe/src/app/core/api/generated/`; `tsc --noEmit` passes for `tsconfig.app.json` and `tsconfig.spec.json`.
- **Web API**: No build started; minimal Hono app (`/health`, `/profile` only).

## 6) Quick Observations / Gaps
- **Dual APIs**: Hono (`mediqweb/mediqapp-api`) and Ktor (`server/`) both exist; Android points to Ktor (8099). Need to clarify which is canonical.
- **Web frontend wiring gaps**: no `provideHttpClient()`, no env/API base URL, no route guards, mocked auth gateway, all area sessions are in-memory mocks. See section 2 above.
- **Web API wiring gaps**: only `/health` and `/profile` routes; supabase middleware configured but underused; no business endpoints. See section 2 above.
- **Data layer**: Ktor uses in-memory repos despite Flyway/DB setup — suggests dev mode or incomplete persistence migration.
- **MCP**: Server has MCP endpoint with stub tools (not obviously wired to real DB yet).
- **Docs freshness**: `docs/*` exist but implementation has evolved (MCP added, routes expanded). New consolidated doc created here.
- **Gradlew location**: Root had gradlew.bat deleted in working tree earlier (restored).

## Key Files to Know
- Android entry/config: `app/src/main/java/com/example/mediq/MainActivity.kt`, `app/src/main/java/com/example/mediq/data/api/RetrofitClient.kt`, `app/build.gradle.kts`
- Server: `server/src/main/kotlin/com/example/mediq/server/MainKt.kt`, `server/src/main/kotlin/com/example/mediq/http/Routes.kt`, `server/src/main/kotlin/com/example/mediq/mcp/McpServer.kt`, `server/build.gradle.kts`
- Web FE: `mediqweb/mediqweb-fe/src/app/app.routes.ts`, `mediqweb/mediqweb-fe/package.json`
- Web API: `mediqweb/mediqapp-api/src/index.ts`, `mediqweb/mediqapp-api/package.json`
- Contracts: `docs/api-contract.md`, `docs/design-contract.md`, `docs/project-map.md`
