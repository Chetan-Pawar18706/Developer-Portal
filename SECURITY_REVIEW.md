# Security Review

Date: 18 November 2026
Scope: complete repository (`backend`, `frontend`, repository-root Playwright setup).

## Executive summary

The platform's authorization model, project isolation, NoSQL-injection defences and
rich-text sanitisation were already structurally sound. Part 15 tightened the remaining
gaps found during review: stale JWT privileges, missing endpoint rate limits, unsafe
attachment URL schemes, internal metadata exposure, socket room staleness, verbose errors,
unsafe password-reset output, and per-user draft isolation.

No secrets were found in tracked files. `.env` files remain ignored and `.env.example`
documents every required setting, including the new `TRUST_PROXY` seed-password overrides.

## Findings and fixes

### High priority

| Finding | Before | Fix |
| --- | --- | --- |
| Stale JWT role / deactivated users | `authenticate` trusted the `role` claim in a 15-minute access token, so a demotion or deactivation remained effective until expiry. | `backend/src/middleware/auth.ts` now loads the user's current `role` and `isActive` from MongoDB on every authenticated request. Deactivated or deleted users receive 401. |
| Stale Socket.IO privileges | A connected socket kept its original role and cached project list, including staff rooms. | `backend/src/sockets/socket.server.ts` re-reads the user on handshake, revalidates membership on `project:join` and `typing`, and exposes `revokeProjectAccess`, called when a member is removed in `project.service.ts`. |
| Password-reset link logged | `auth.service.ts` wrote the reset URL to stdout outside tests. | Removed the log; email delivery is the only channel. |
| Missing rate limits | Only register/login/forgot-password were limited. Refresh, logout, reset, uploads, search and the whole API were unbounded. | Added global API, refresh/logout, reset, upload and search limiters in `backend/src/middleware/rateLimit.ts` and wired them in `app.ts`, `auth.routes.ts`, `file.routes.ts`, `project.routes.ts` and `routes/index.ts`. Test mode uses high limits so suites stay deterministic. |
| Unsafe attachment URL schemes | Attachment schemas accepted any valid URL, including `javascript:`. | Added shared `httpAttachmentUrlSchema` used by requirement, comment and issue attachment schemas. Only `http`/`https` URLs are accepted. |
| Internal file storage path exposed | Public file/version responses included `storagePath`. | Removed from `PublicFile`, `PublicFileVersion` and the Angular `FileVersion` model. Downloads continue to use server-side path resolution. |

### Medium priority

| Finding | Before | Fix |
| --- | --- | --- |
| Path traversal risk in file storage | Paths came from persisted data; validation existed but was not directly covered. | Added `storage.service.test.ts` covering `../`, absolute paths, `./` segments and safe reads. `LocalDiskStorage.resolvePath` rejects anything outside the configured root. |
| Seed credentials printed | `npm run seed` printed demo passwords. | Seed now prints only roles and emails and supports `SEED_ADMIN_PASSWORD`, `SEED_PM_PASSWORD`, `SEED_DEVELOPER_PASSWORD`, `SEED_CLIENT_PASSWORD` overrides. |
| Reset URL interpolated into HTML | `mail.service.ts` inserted the URL directly into HTML. | The URL is escaped with the shared `escapeHtml` helper before interpolation. |
| Refresh tokens survived privilege changes | Role/status changes left old refresh-token hashes valid. | `user.service.ts` clears `refreshTokenHash` on role or status changes. |
| Verbose 404 / upload errors | 404 messages echoed the request method and URL; unknown multer errors echoed raw messages. | 404 now returns a static `Route not found`; generic upload failures no longer expose internal text. |
| No `Cache-Control` on API responses | Sensitive API responses could be cached by intermediaries. | All `/api` responses set `Cache-Control: no-store`. |
| Requirement drafts shared across accounts on one browser | localStorage key was project/requirement only. | Draft key now includes the current user id, with an `anonymous` fallback. |
| Cookie hardening | Access/refresh cookies already used httpOnly, SameSite, Secure in production and scoped paths. | Verified by an automated test; global limiter uses configurable `TRUST_PROXY` so production `Secure` cookies work behind one proxy hop. |
| CSP / headers | Helmet enabled with default CSP and no-referrer already set. | Confirmed with `security.test.ts`; `X-Content-Type-Options: nosniff` is enforced. |

### Accepted residual risks / operational notes

- Uploads still use `multer.memoryStorage()` because files are written to a private disk
  store in the same request; size (25 MB), count (20), extension, MIME and per-user upload
  rate limits constrain abuse. A virus scanner or object storage with presigned URLs is a
  future hardening step.
- `CLIENT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` and mail credentials must be set from
  the deployment environment. Development defaults are not used in production.
- Rate-limit state is in-memory per process. Multiple backend replicas should use a shared
  store (for example Redis) before horizontal scaling.
- The API sets `Cache-Control: no-store`; the Angular production build should be served
  behind HTTPS with HSTS at the reverse proxy.

## Dependency audit

Commands run from the repository root:

- `cd backend && npm audit`
- `cd frontend && npm audit`
- `npm audit` (root e2e tooling)

### `backend`

Initial result: 29 moderate-severity advisories, 0 high/critical, all in development
tooling (`jest`, `eslint`, `typescript-eslint`, `glob`/`minimatch`), plus direct advisories
for `node-cron` (via `uuid`) and `sanitize-html`.

Actions:

- Applied all non-breaking fixes with `npm audit fix`.
- Upgraded `sanitize-html` to the patched 2.x line (no breaking change).
- Remaining advisories require major-version upgrades of `jest` and `node-cron`; they are
  test/runtime tooling with no user-input path into the affected `uuid` code. They are
  tracked as follow-up work and documented below.

Final result: 20 moderate-severity advisories, 0 high/critical. All remaining
advisories are in the Jest 30 test toolchain (`glob`, `minimatch`, `test-exclude`
and transitive Jest packages) or in `node-cron` 3.x via its transitive `uuid`.
Resolving them requires breaking major upgrades (`jest@29` or `node-cron@4`) and
does not affect production request handling; they are tracked as follow-up work.

### `frontend`

0 vulnerabilities across all severity levels.

### root (`@playwright/test`)

0 vulnerabilities across all severity levels.

## Test coverage added

- Backend route/integration tests: authentication flow and cookie flags, role gates,
  project isolation, task move ordering, internal comment/file visibility, upload
  validation (extension, size, internal flag, new-version body), sign-off rules,
  NoSQL operator injection, mass assignment, rich-text XSS and response hardening.
- Backend unit tests: `LocalDiskStorage` path-traversal rejection.
- Frontend unit tests: `TaskStore` loading, filtering, grouping, optimistic move with
  rollback, realtime updates and saving states. Existing `AuthService`, `authInterceptor`
  and `roleGuard` specs were retained and exercised.
- Playwright e2e: complete client → PM → developer → client delivery workflow, seeded
  with demo accounts.

## How to run the checks

```bash
# backend (requires MongoDB available at MONGO_URI)
cd backend
npm run build
npm test -- --coverage
npm audit

# frontend
cd frontend
npm run build
npm test -- --watch=false
npm audit

# e2e (requires local mongod on 127.0.0.1:27017)
cd ..
npm run e2e:install   # first time only
npm run e2e
```
