# Testing

This is the single source of truth for the project's test cases and automated test
inventory. The platform has two automated layers:

- **Backend** — Jest + supertest + `mongodb-memory-server` (no external MongoDB required).
- **Frontend** — Angular unit tests run by the Angular unit-test builder.

Playwright/e2e tooling is intentionally not part of this repository.

## Commands

```bash
# Backend unit + integration tests with coverage
cd backend
npm run build
npm test -- --coverage
npm audit

# Frontend unit tests
cd frontend
npm run build
npm test -- --watch=false
npm audit
```

## Test cases

Each case lists the precondition/steps, expected result and the automated spec that
covers it.

| ID | Area | Steps | Expected result | Coverage |
| --- | --- | --- | --- | --- |
| TC-01 | Auth | Log in with a valid seeded account. | `200`, access token in body, httpOnly refresh cookie, correct role. | Backend `auth.test.ts` |
| TC-02 | Auth | Log in with a wrong password. | `401`, no access token issued. | Backend `auth.test.ts` |
| TC-03 | Auth | Call `/refresh` with a valid refresh cookie. | New access token and rotated refresh cookie. | Backend `auth.test.ts` |
| TC-04 | Auth | Deactivate a user, then call an authenticated route with their token. | `401`; current `isActive` is checked on every request. | Backend `security.test.ts` |
| TC-05 | RBAC | Client calls `PATCH /api/users/:id/role`. | `403`; role changes are admin-only. | Backend `security.test.ts` |
| TC-06 | Projects | Client B requests project A by id. | `403`/`404`; project membership is enforced in the service. | Backend `project.service.test.ts` |
| TC-07 | Requirements | Client submits a draft requirement, PM approves it. | Status moves `draft → submitted → under_review → approved`; activity is logged. | Backend `requirement.service.test.ts` |
| TC-08 | Requirements | Try to edit an approved requirement. | Edit is rejected to protect approved scope. | Backend `requirement.service.test.ts` |
| TC-09 | Requirements | Create a change request from an approved requirement. | New requirement stores `changeRequestOf`. | Backend `requirement.service.test.ts` |
| TC-10 | Tasks | PM creates a task and assigns a developer. | Assignee is stored; assignee receives a notification. | Backend `task.service.test.ts` |
| TC-11 | Tasks | Developer updates an assigned task, then an unassigned one. | Assigned update succeeds; unassigned update is `403`. | Backend `task.service.test.ts` |
| TC-12 | Tasks | Log `0.25` hours and then `0` hours. | First is accepted; second fails model validation. | Backend `task.service.test.ts` |
| TC-13 | Tasks | Move a task in the board and simulate a failed save. | Order persists; the Angular store rolls back optimistic state. | Frontend `task.store.spec.ts` |
| TC-14 | Tasks | Client approves a delivered task. | `clientReview.status = approved`, `by` and `at` are set. | Backend `task.service.test.ts` |
| TC-15 | Issues | Client raises a bug; PM reviews it. | Issue is auto-assigned to the PM and status starts at `open`. | Backend `issue.routes.test.ts` |
| TC-16 | Issues | PM converts an issue into a task. | `issue.linkedTask` and `task.linkedIssue` reference each other. | Backend `issue.routes.test.ts` |
| TC-17 | Comments | PM writes an internal comment; client lists comments. | Internal comment is absent from the client response. | Backend `comment.routes.test.ts` |
| TC-18 | Comments | Mention a teammate in a comment. | Mentioned user receives a notification and realtime event. | Backend `comment.routes.test.ts`, `socket.server.test.ts` |
| TC-19 | Files | Upload `.exe` and a 26 MB PDF. | Both are rejected by extension/MIME/size validation. | Backend `file.routes.test.ts` |
| TC-20 | Files | Upload a new version of an existing PDF. | `version` increments and previous `versions` entries remain. | Backend `file.routes.test.ts` |
| TC-21 | Files | Mark a file internal, then list as client. | Internal file is not returned to the client. | Backend `file.routes.test.ts` |
| TC-22 | Delivery | Client signs off a completed project with rating 4. | `deliverySignOff` stores signer, time, rating and feedback. | Backend `sign-off.service.test.ts` |
| TC-23 | Security | Send `$where`/`$ne` operators in query parameters. | Request is rejected by Zod/mongo-sanitize validation. | Backend `security.test.ts` |
| TC-24 | Security | Post rich text containing `<script>`. | Stored HTML is sanitized before rendering. | Backend `security.test.ts` |
| TC-25 | Profile | Update GitHub with a handle and LinkedIn with a full URL. | Both are accepted; links render correctly on the public profile. | Backend `user.test.ts`, Frontend `profile.service.spec.ts` |
| TC-26 | Profile | Upload a 2 MB PNG, then a `.gif`. | PNG is stored and served; `.gif` is rejected. | Backend `user.test.ts` |
| TC-27 | Profile | Paste an `http(s)` avatar URL, save, then open the profile as another user. | The external image is shown; the previous uploaded file is removed. Broken images fall back to initials instead of showing alt text. | Backend `user.test.ts`, Frontend `user-avatar.component.spec.ts` |
| TC-28 | Profile | Request another user's public profile. | Work/social details are returned; email and storage paths are absent. | Backend `user.test.ts` |
| TC-29 | Dashboards | Seed known tasks, issues and time logs, then load dashboards. | Counts, hour totals, workload and aging buckets match the fixtures. | Backend `dashboard.service.test.ts` |
| TC-30 | Frontend | Developer navigates to a PM-only route. | `roleGuard` redirects the user away from the route. | Frontend `role.guard.spec.ts` |
| TC-31 | Search | Search projects, tasks and requirements with a common keyword. | Only documents the caller may access are returned. | Backend `search.service.test.ts` |
| TC-32 | Notifications | Mark one notification read, then mark all read. | Read flags update and unread count decreases. | Backend `notification.routes.test.ts` |
| TC-33 | Avatar viewer | Open another user's profile and click their picture. | Full-size viewer opens; clicking outside or pressing `Esc` closes it. | Frontend developer-profile component |

## Automated suite inventory

| Layer | Files | Focus |
| --- | --- | --- |
| Backend routes | `auth.test.ts`, `user.test.ts`, `security.test.ts`, `health.test.ts`, `comment.routes.test.ts`, `file.routes.test.ts`, `issue.routes.test.ts`, `notification.routes.test.ts` | HTTP status codes, cookies, validation, role/project gates, internal visibility. |
| Backend services | `project.service.test.ts`, `requirement.service.test.ts`, `task.service.test.ts`, `sign-off.service.test.ts`, `search.service.test.ts`, `dashboard.service.test.ts`, `storage.service.test.ts` | Business rules, aggregation, path-traversal rejection. |
| Backend realtime | `socket.server.test.ts` | Room isolation, membership revalidation, live updates. |
| Frontend | `app.spec.ts`, `landing.component.spec.ts`, `role.guard.spec.ts`, `auth.service.spec.ts`, `auth.interceptor.spec.ts`, `task.store.spec.ts`, `profile.service.spec.ts`, `user-avatar.component.spec.ts` | Guards, token flow, store optimistic updates, profile API, avatar URL resolution and broken-image fallback. |

## Manual smoke test

After seeding, sign in as each demo user and confirm that the client can create a
project, the PM can review and assign work, the developer can update an assigned task,
and the client can approve it.

To check the profile flow:

1. Open **Profile** as a developer.
2. Upload a PNG/JPEG picture or paste an `http(s)` image URL, then save work/social details.
3. Sign in as another user and open a project's **Team** list.
4. Click a member name to open the public developer profile.
5. Click the profile picture to open the full-size viewer.

`SECURITY_REVIEW.md` documents the security audit, dependency-audit results and hardening
decisions.
