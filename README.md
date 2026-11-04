# Client-Developer Communication & Project Management Platform

Clients create projects and requirements; the dev team reviews them, plans tasks, and
reports progress. Clients follow progress, raise issues, discuss in comments, exchange
files, and sign off on delivery.

This repository contains the two applications of the platform:

```
backend/    Node.js + Express + TypeScript + Mongoose API
frontend/   Angular (standalone, SCSS) client
```

## Prerequisites

- Node.js 22+ and npm
- MongoDB running locally (or a MongoDB connection string)

## Backend

```bash
cd backend
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev               # starts http://localhost:5000
```

Useful commands:

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API in watch mode (ts-node-dev) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled API |
| `npm test` | Run Jest tests |
| `npm run seed` | Reset development data and seed demo users, projects, requirements and activity |
| `npm run lint` | Run ESLint |

Health check: `GET http://localhost:5000/api/health`

```json
{ "success": true, "data": { "status": "ok", "timestamp": "..." }, "message": "API is healthy" }
```

Environment variables are validated at startup (`backend/src/config/env.ts`). Update
`backend/.env` before running the server. `.env` is never committed.

### Demo accounts

Run `npm run seed` in `backend/` to reset the development database and load the demo
accounts, projects, requirements, version history and activity history. The seed script
is blocked when `NODE_ENV=production`.

| Name | Role | Email | Password |
| --- | --- | --- | --- |
| DevPortal Admin | admin | `admin@devpor.com` | `Admin@123` |
| Chetan Pawar | pm | `chetanpawar18706@gmail.com` | `Chetan@123` |
| Raghav Shastri | developer | `raghavshastri@gmail.com` | `raghav@123` |
| Ishwari Kokankar | developer | `iswarikokankar@gmail.com` | `ishwari@123` |
| Nikhil Sury | client | `nikhilsury@gmail.com` | `nikhil@123` |

The seeded projects cover draft, submitted, active, on-hold and completed states so
each role has something meaningful to review immediately. Requirements cover the full
review lifecycle, including approvals, clarification requests, version history and a
linked change request.

### Requirements API

All requirement endpoints require an authenticated user with access to the parent project.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/projects/:id/requirements` | List project requirements with search, status, priority, type and pagination |
| `POST` | `/api/projects/:id/requirements` | Create a draft requirement (admin, pm or the client owner) |
| `GET` | `/api/requirements/:id` | Get a requirement with versions and change-request link |
| `PATCH` | `/api/requirements/:id` | Edit a requirement; each edit appends a version; approved requirements are locked |
| `PATCH` | `/api/requirements/:id/status` | Move through the review workflow |
| `POST` | `/api/requirements/:id/change-request` | Create a linked draft requirement from an approved requirement |

Rich-text descriptions are sanitized on the server with `sanitize-html`. Status changes
are role-aware: the client owner submits or approves, while PM/admin users start review,
request clarification or reject. Clarification and rejection require a review note.

## Frontend

```bash
cd frontend
npm install
npm start                 # starts http://localhost:4200
```

Useful commands:

| Command | Description |
| --- | --- |
| `npm start` | Start the Angular dev server |
| `npm run build` | Production build into `dist/` |
| `npm test -- --watch=false` | Run unit tests once |

The API and socket URLs live in `frontend/src/environments/`:

```ts
apiUrl: 'http://localhost:5000/api'
socketUrl: 'http://localhost:5000'
```

There is no dev-server proxy: the browser calls the backend directly at
`http://localhost:5000`, and the backend allows the Angular origin via CORS
(`CLIENT_URL`, credentials enabled).

## Project structure

```
backend/
  src/
    config/      env validation, database connection
    models/      Mongoose models
    controllers/ HTTP controllers
    routes/      Express routers (mounted at /api)
    middleware/  auth, roles, validation, error handling
    services/    business logic
    sockets/     Socket.IO handlers
    scripts/     seed and maintenance scripts
    utils/       shared helpers
    types/       shared TypeScript types
  uploads/       private uploaded files (not committed)
frontend/
  src/app/
    core/        singletons: auth, HTTP interceptors, guards
    shared/      reusable components, directives, pipes
    features/    landing, auth, dashboard, projects, requirements, tasks,
                 issues, communication, files, admin
  src/environments/
```
