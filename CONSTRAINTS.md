# MediQ Quality Constraints

These constraints lock in the current design and prevent silent quality
regressions. They do not change any behavior, file, or API — they only
guard the existing bar.

## Web frontend (mediqweb/mediqweb-fe)

### TypeScript / type safety
- [ ] `tsc --noEmit -p tsconfig.app.json` must pass with **zero errors**.
- [ ] No new `@ts-ignore`, `// @ts-expect-error`, or `eslint-disable` comments.
- [ ] No `as unknown as` casts without a `// TODO: justify` comment explaining
      why a safer cast or mapping is not possible.
- [ ] No implicit `any`: every function parameter and return type must be
      explicitly typed.
- [ ] Gateway (API) models → domain model conversions must be **explicit
      mappings**, not casts. If the API returns `description?: string` and the
      domain requires `description: string`, map with `?? ''` (as done in
      `http-admin.service.ts`), do not cast through.

### RxJS
- [ ] No `.toPromise()` (removed in RxJS 7). Use `firstValueFrom` /
      `lastValueFrom` + `await`.

### Build & tests
- [ ] `npm run build` must succeed.
- [ ] `npm test` must pass with no skipped or deleted tests.
- [ ] No unimplemented stubs left in place of real logic.

### Runtime / network
- [ ] Ktor `cors.origins` in `server/src/main/resources/application.conf`
      must keep `http://localhost:4200`.
- [ ] `window.__env.API_BASE_URL` must resolve to `http://localhost:8099`
      at runtime (not the `__API_BASE_URL__` placeholder in `index.html`).

## Android (app/)

- [ ] `./gradlew :app:assembleDebug` must stay green.
- [ ] `./gradlew :app:lint` must pass.
- [ ] No `Color(0x…)` or inline `fontSize` outside `ui/theme` (token-only
      styling per the design contract).
- [ ] Compose screens must keep stateless UI + UiState split; previews in
      `*Previews.kt`, samples in `*Samples.kt`.

## Ktor server (server/)

- [ ] `gradlew.bat build -x test` must succeed.
- [ ] Route paths in `http/Routes.kt` must stay in sync with
      `mediqweb/mediqweb-fe/src/app/core/api/api-constants.ts`.
- [ ] All data routes remain JWT-authenticated (`authenticate("bearer")`).
- [ ] CORS origins must include `http://localhost:4200`.

## Repository hygiene
- [ ] Never commit `.env`, `local.properties`, or secrets.
- [ ] No new dependencies without checking bundle/size impact.

## What this guards against (based on what we just fixed)

| Constraint | Bug it prevents |
|---|---|
| Explicit gateway→domain mapping | `Specialization.description` (`string \| undefined`) assigned to domain `description: string` |
| No `as unknown as` | `accountsResp.patients` typed as `StaffAccount[]` but state expects `PatientAccount[]` |
| `tsc --noEmit` zero errors | All the TS2345/TS2322/TS2493/TS2339 errors in `http-admin.service.ts` and `http-secretary.service.ts` |
| No `.toPromise()` | `toPromise() does not exist on Promise<ClinicHours[]>` |
| CORS keeps `:4200` | Browser blocked from reaching Ktor on `localhost:8099` |
| `API_BASE_URL` not placeholder | All HTTP calls targeting the literal string `'__API_BASE_URL__'` |
