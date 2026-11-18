# Client-Developer Communication & Project Management Platform

## Overview

This platform manages the full delivery conversation between a client and a software
team. A client creates a project, submits requirements, follows task progress, raises
issues, discusses changes in comments, exchanges files and signs off on delivery. The
delivery team reviews requirements, creates and assigns tasks, updates status, logs time
and publishes deliverables.

The repository contains two applications and a root Playwright suite:

```
backend/    Node.js + Express + TypeScript + Mongoose REST/Socket.IO API
frontend/   Angular standalone SPA
e2e/        Playwright end-to-end tests (root package)
```

Access is role-based (`admin`, `pm`, `developer`, `client`). Permissions are enforced on
the backend; Angular guards and a role directive mirror them in the UI. Clients only see
their own projects, and internal comments/files are never returned to clients.

## Features

- Authentication with 15-minute JWT access tokens and 7-day httpOnly refresh cookies,
  password reset by email, profile settings and notification preferences.
- Project lifecycle with clients, members, priorities, budgets, dates, tags, statuses,
  delivery sign-off and PDF reports.
- Requirement workflow: draft → submitted → under review → clarification/approved/rejected,
  version history, approved-scope locking and linked change requests.
- Task workspace: board, sortable list and calendar views, drag-and-drop ordering,
  assignment, priorities, due dates, labels, checklists, time logs, client review and
  global cross-project task listing.
- Issue tracking with severity/status filters, PM auto-assignment, client close/reopen,
  staff progress updates and conversion into a task.
- Communication: project/entity comments with mentions, reactions, internal notes and
  real-time updates over Socket.IO.
- File exchange: multi-file upload, folder metadata, internal/private flag, previews,
  downloads and version history. Paths stay private on the server.
- Dashboards, PM workload, issue aging, project health, search and notifications.
- Angular Material UI, lazy-loaded routes, signals, typed reactive forms, charts and a
  rich-text editor.

## Tech stack

| Layer | Technologies |
| --- | --- |
| API | Node.js, Express 4, TypeScript (strict), Mongoose/MongoDB, Zod, JWT, bcryptjs |
| Realtime | Socket.IO with membership-aware rooms |
| Files/mail/jobs | multer, private local disk storage, nodemailer, node-cron, pdfkit |
| Security | Helmet, CORS with credentials, express-rate-limit, express-mongo-sanitize, sanitize-html |
| Frontend | Angular 22 standalone components, signals, OnPush, Angular Material/CDK, RxJS, ng2-charts, TipTap, socket.io-client |
| Unit/integration tests | Jest, supertest, mongodb-memory-server, Angular CLI test builder, Vitest/jsdom |
| End-to-end tests | Playwright + Chromium at the repository root |

## Prerequisites

- Node.js 22+ and npm
- MongoDB listening locally or a reachable MongoDB connection string
- Optional: an SMTP account, or use `MAIL_PROVIDER=ethereal` for a local preview inbox

## Setup

```bash
git clone <repository-url>
cd Developer-Portal

# API
cd backend
npm install
copy .env.example .env        # macOS/Linux: cp .env.example .env
npm run dev                   # http://localhost:5000

# SPA (in another terminal)
cd frontend
npm install
npm start                     # http://localhost:4200

# End-to-end tooling (root, once)
cd ..
npm install
npm run e2e:install
```

The API health check is `GET http://localhost:5000/api/health`. There is no Angular
dev-server proxy: the browser calls `http://localhost:5000/api` directly and CORS allows
`CLIENT_URL` with credentials.

## Environment variables

Backend variables are validated at startup in `backend/src/config/env.ts`. Never commit
`.env`; `backend/.env.example` is the template that stays up to date.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | No | `development` | `development`, `test` or `production` |
| `PORT` | No | `5000` | API listen port |
| `MONGO_URI` | Yes | — | MongoDB connection string |
| `JWT_SECRET` | Yes | — | Access-token signing secret (minimum 32 characters) |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh-token signing secret (minimum 32 characters) |
| `CLIENT_URL` | Yes | — | Allowed browser origin for CORS |
| `TRUST_PROXY` | No | `1` | Trusted reverse-proxy hops for rate limits/secure cookies; use `0` when exposed directly |
| `MAIL_PROVIDER` | No | `smtp` | `smtp` or `ethereal` |
| `SMTP_HOST` | No | `smtp.example.com` | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_USER` | No | `your-smtp-user` | SMTP username |
| `SMTP_PASS` | No | `your-smtp-password` | SMTP password |
| `SMTP_FROM` | No | `"Developer Portal" <no-reply@developer-portal.local>` | From header |
| `SEED_ADMIN_PASSWORD` | No | script default | Optional seed password override (development only) |
| `SEED_PM_PASSWORD` | No | script default | Optional seed password override (development only) |
| `SEED_DEVELOPER_PASSWORD` | No | script default | Optional seed password override (development only) |
| `SEED_CLIENT_PASSWORD` | No | script default | Optional seed password override (development only) |

Frontend URLs live in `frontend/src/environments/environment.ts` and
`environment.development.ts`:

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  socketUrl: 'http://localhost:5000',
};
```

Playwright overrides (all optional):

| Variable | Default |
| --- | --- |
| `E2E_MONGO_URI` | `mongodb://127.0.0.1:27017/devportal-e2e` |
| `E2E_API_URL` | `http://localhost:5000` |
| `E2E_FRONTEND_URL` | `http://localhost:4200` |
| `E2E_CLIENT_EMAIL` / `E2E_CLIENT_PASSWORD` | seeded client demo account |
| `E2E_PM_EMAIL` / `E2E_PM_PASSWORD` | seeded PM demo account |
| `E2E_DEVELOPER_EMAIL` / `E2E_DEVELOPER_PASSWORD` | seeded developer demo account |

## Seed users

Run `npm run seed` in `backend/` to reset the development database and load demo users,
projects, requirements, tasks, version history and activity. Use `npm run seed:tasks` to
add the realistic task set without deleting existing data. Both scripts refuse to run
when `NODE_ENV=production`.

| Name | Role | Email | Password |
| --- | --- | --- | --- |
| DevPortal Admin | admin | `admin@devpor.com` | `Admin@123` |
| Chetan Pawar | pm | `chetanpawar18706@gmail.com` | `Chetan@123` |
| Raghav Shastri | developer | `raghavshastri@gmail.com` | `raghav@123` |
| Ishwari Kokankar | developer | `iswarikokankar@gmail.com` | `ishwari@123` |
| Nikhil Sury | client | `nikhilsury@gmail.com` | `nikhil@123` |

Seeded projects cover draft, submitted, active, on-hold and completed states.
Requirements cover approvals, clarification requests, version history and a linked
change request. The Playwright suite reseeds its own `devportal-e2e` database before it
runs, so it never touches development data.

## Scripts

### `backend/`

| Command | Description |
| --- | --- |
| `npm run dev` | API in watch mode with `ts-node-dev` |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm start` | Run the compiled API |
| `npm test` | Jest unit/integration tests |
| `npm test -- --coverage` | Tests plus coverage report in `backend/coverage/` |
| `npm run lint` | ESLint |
| `npm run seed` | Reset and seed development data |
| `npm run seed:tasks` | Add demo tasks without deleting data |

### `frontend/`

| Command | Description |
| --- | --- |
| `npm start` | Angular dev server on port 4200 |
| `npm run build` | Production build into `dist/` |
| `npm run watch` | Development build in watch mode |
| `npm test -- --watch=false` | Run unit tests once |

### Repository root

| Command | Description |
| --- | --- |
| `npm run e2e` | Run Playwright against the seeded backend and Angular dev server |
| `npm run e2e:ui` | Open the Playwright UI |
| `npm run e2e:install` | Install the Chromium browser |

## Folder structure

```
Developer-Portal/
├── backend/
│   ├── src/
│   │   ├── config/        environment validation, MongoDB connection, multer
│   │   ├── controllers/   HTTP controllers
│   │   ├── jobs/          scheduled notification and project-health jobs
│   │   ├── middleware/    auth, role, project access, validation, rate limits, errors
│   │   ├── models/        Mongoose schemas
│   │   ├── routes/        Express routers mounted under /api
│   │   ├── scripts/       seed and maintenance scripts
│   │   ├── services/      business logic and DTO mapping
│   │   ├── sockets/       Socket.IO server and room authorization
│   │   ├── tests/         shared factories and database test harness
│   │   ├── types/         Express request augmentation
│   │   └── utils/         errors, responses, cookies, tokens
│   ├── uploads/           private uploaded files (not committed)
│   ├── jest.config.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/app/
│   │   ├── core/          auth, HTTP interceptors, guards, models, services
│   │   ├── shared/        reusable components, directives, pipes, utilities
│   │   └── features/      auth, dashboard, projects, requirements, tasks, issues,
│   │                      communication, files, profile, admin
│   ├── src/environments/  API and socket URLs
│   └── package.json
├── e2e/                   Playwright global setup and delivery-flow spec
├── playwright.config.ts
├── SECURITY_REVIEW.md
└── package.json           root e2e scripts
```

## API summary

All endpoints are mounted under `/api`. Success responses use
`{ "success": true, "data": ..., "message": ... }`; list responses use
`{ data, total, page, limit }` inside `data`. Errors use the same envelope with
`success: false`. Query parameters support pagination, sorting and filtering. Requests
require a Bearer access token except the public auth and health routes; the refresh
cookie is sent automatically with `credentials: include`.

| Area | Endpoints |
| --- | --- |
| Health | `GET /api/health` |
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`; `GET /api/auth/me`; `PATCH /api/auth/profile` |
| Users | `GET /api/users`, `GET /api/users/lookup`; `POST /api/users`; `PATCH /api/users/me`, `/api/users/me/password`, `/api/users/:id/role`, `/api/users/:id/status` |
| Projects | `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/:id`, `PATCH /api/projects/:id/status`, `PATCH /api/projects/:id/sign-off`, `POST/DELETE /api/projects/:id/members`, `GET /api/projects/:id/activity`, `GET /api/projects/:id/report.pdf` |
| Requirements | `GET /api/requirements`, `GET /api/projects/:id/requirements`, `POST /api/projects/:id/requirements`, `GET/PATCH /api/requirements/:id`, `PATCH /api/requirements/:id/status`, `POST /api/requirements/:id/change-request`, `GET /api/requirements/:id/progress` |
| Tasks | `GET /api/tasks`, `GET /api/projects/:id/tasks`, `POST /api/projects/:id/tasks`, `GET/PATCH/DELETE /api/tasks/:id`, `PATCH /api/tasks/:id/move`, `POST /api/tasks/:id/time-logs`, `PATCH /api/tasks/:id/subtasks`, `POST /api/tasks/:id/client-review` |
| Issues | `GET /api/issues`, `GET /api/projects/:id/issues`, `POST /api/projects/:id/issues`, `GET/PATCH /api/issues/:id`, `PATCH /api/issues/:id/status`, `POST /api/issues/:id/convert-to-task` |
| Comments | `GET /api/comments`, `GET /api/comments/global`, `POST /api/comments`, `PATCH/DELETE /api/comments/:id`, `POST /api/comments/:id/reactions` |
| Files | `GET /api/files`, `GET /api/projects/:id/files`, `POST /api/projects/:id/files`, `GET /api/files/:id/download`, `GET /api/files/:id/preview`, `POST /api/files/:id/new-version`, `DELETE /api/files/:id` |
| Dashboards/reports | `GET /api/dashboard/me`, `GET /api/dashboard/admin`, `GET /api/projects/:id/dashboard`, `GET /api/projects/:id/dashboard/pm`, `GET /api/reports` |
| Search/notifications | `GET /api/search`, `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/read-all`, `PATCH /api/notifications/:id/read` |

Role gates are applied in route middleware (`allow`, `authenticate`, `projectAccess`) and
again in services where data visibility depends on project membership. Clients never
receive `isInternal` comments/files or internal metadata.

## Testing

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

# End-to-end delivery workflow (local mongod required)
cd ..
npm run e2e
npm audit
```

Backend tests use `mongodb-memory-server`, so no external database is needed for them.
The e2e suite starts fresh API and Angular servers, seeds `devportal-e2e`, and walks the
full flow: client login → project → requirement → PM review → client approval → PM task
→ developer move → client task approval.

For a manual smoke test after seeding, sign in as each demo user and confirm that the
client can create a project, the PM can review and assign work, the developer can update
an assigned task, and the client can approve it. `SECURITY_REVIEW.md` documents the
security audit, dependency-audit results and hardening decisions.
