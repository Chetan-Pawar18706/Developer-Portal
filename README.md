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
| `npm run seed` | Reset development data and seed demo users, projects, requirements, tasks and activity |
| `npm run seed:tasks` | Add realistic demo tasks to the existing database without deleting data |
| `npm run lint` | Run ESLint |

Health check: `GET http://localhost:5000/api/health`

```json
{ "success": true, "data": { "status": "ok", "timestamp": "..." }, "message": "API is healthy" }
```

Environment variables are validated at startup (`backend/src/config/env.ts`). Update
`backend/.env` before running the server. `.env` is never committed.

### Demo accounts

Run `npm run seed` in `backend/` to reset the development database and load the demo
accounts, projects, requirements, tasks, version history and activity history. To add
the same realistic task set to a database you already have, run `npm run seed:tasks`
instead; it is idempotent and never deletes existing data. Both scripts are blocked when
`NODE_ENV=production`.

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
| `GET` | `/api/requirements` | List requirements across every project the user can access, with an optional `projectId` filter |
| `GET` | `/api/projects/:id/requirements` | List project requirements with search, status, priority, type and pagination |
| `POST` | `/api/projects/:id/requirements` | Create a draft requirement (admin, pm or the client owner) |
| `GET` | `/api/requirements/:id` | Get a requirement with versions and change-request link |
| `PATCH` | `/api/requirements/:id` | Edit a requirement; each edit appends a version; approved requirements are locked |
| `PATCH` | `/api/requirements/:id/status` | Move through the review workflow |
| `POST` | `/api/requirements/:id/change-request` | Create a linked draft requirement from an approved requirement |

Rich-text descriptions are sanitized on the server with `sanitize-html`. Status changes
are role-aware: the client owner submits or approves, while PM/admin users start review,
request clarification or reject. Clarification and rejection require a review note.

### Tasks API

Every task endpoint requires authentication and project access. Clients only receive
tasks from their own projects and cannot edit them.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/tasks` | List tasks across every project the user can access, with optional `projectId` and the same filters |
| `GET` | `/api/projects/:id/tasks` | List project tasks with search, assignee, status, priority, label, due-date and pagination filters |
| `POST` | `/api/projects/:id/tasks` | Create a task in `todo` (admin or pm) |
| `GET` | `/api/tasks/:id` | Get a task |
| `PATCH` | `/api/tasks/:id` | Update task details; developers may update only tasks assigned to them |
| `DELETE` | `/api/tasks/:id` | Delete a task (admin or pm) |
| `PATCH` | `/api/tasks/:id/move` | Move a task to a status column and reorder both columns |
| `POST` | `/api/tasks/:id/time-logs` | Log hours against a task |
| `PATCH` | `/api/tasks/:id/subtasks` | Replace the task checklist |
| `POST` | `/api/tasks/:id/client-review` | Approve or request changes on a task in review (client owner) |
| `GET` | `/api/requirements/:id/progress` | Requirement task completion, status counts, hours and overdue totals |

Task statuses are `todo`, `in_progress`, `in_review`, `blocked` and `done`. Ordering is
stored per project and status, and moving a task reindexes the source and target columns.
Client approval moves the task to `done`; requesting changes moves it back to
`in_progress` with a required note. Task activity is recorded in the project activity log.

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

The global **Tasks** page at `/tasks` lists tasks across every project the signed-in user
can access, with project, user, status and priority filters. Selecting a task opens
its project board with the task dialog. Project tasks are also available in the project
detail **Tasks** tab. That workspace has board, sortable list and due-date calendar views,
role-aware filters, optimistic drag-and-drop ordering, a task editor with checklist and
time logging, and client review controls for tasks in review. Requirement detail pages
show linked task progress and let users open the task editor directly.

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
