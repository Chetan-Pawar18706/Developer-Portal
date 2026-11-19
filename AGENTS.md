# Project: Client-Developer Communication & Project Management Platform

## Goal
Clients create projects and requirements. The dev team reviews them, creates and
assigns tasks, and updates progress. Clients review progress, raise issues, discuss via
comments, exchange files, and sign off on delivery.

## Repo layout (exactly two app folders)
project-platform/
  backend/    Node + Express + TypeScript (strict) + Mongoose + MongoDB
    src/{config,models,controllers,routes,middleware,services,sockets,utils,types}
    uploads/ (private), .env, .env.example
  frontend/   Angular (latest stable), standalone components, signals, SCSS
    src/app/{core,shared,features/{auth,dashboard,projects,requirements,tasks,
    issues,communication,files,admin}}
  docker-compose.yml, README.md

## Stack
- Backend: Express, Mongoose, zod, JWT access (15 min) + refresh (7 days, httpOnly
  cookie), bcryptjs, multer, Socket.IO, nodemailer, node-cron, pdfkit.
- Frontend: Angular Material, CDK drag-drop, typed Reactive Forms, OnPush, lazy-loaded
  routes, ng2-charts, socket.io-client, TipTap or ngx-quill.
- Tests: Jest + supertest + mongodb-memory-server (backend), Angular unit tests. Test
  cases are documented in `TESTING.md`.

## Roles
admin, pm, developer, client
- admin: everything.
- pm: reviews requirements, creates/assigns tasks, manages members.
- developer: updates only assigned tasks, logs time, discusses, uploads files.
- client: creates projects/requirements, approves/rejects, views progress, raises
  issues, comments, uploads files. Sees only their own projects.
- Comments and files have isInternal; clients must never receive internal items.
- Permissions are enforced on the BACKEND (middleware) and mirrored in Angular
  (guards + *appHasRole directive).

## API conventions
- Base path /api. Response: { success, data, message }.
- Lists: { data, total, page, limit } with pagination, sorting, filtering.
- Central error handler, zod validation middleware, auth + role + project-membership
  middleware. Layering: routes -> controllers -> services -> models.

## Coding rules
- TypeScript strict on both sides. No `any` unless justified in a comment.
- Complete, runnable code. No TODOs, pseudo-code, or placeholders.
- Never commit secrets. Keep .env.example up to date.
- Small single-purpose functions, meaningful names.

## Working rules for the agent
1. Work only on the part I give you. Do not start the next part.
2. Run the commands yourself (install, build, test, run). Fix errors until they pass.
3. Before finishing a part: backend `npm run build` and `npm test` pass, frontend
   `ng build` and `ng test --watch=false` pass.
4. Commit with the message "Part N: <title>".
5. End with a short report: what was built, files created, how to run it, how to test
   it manually, and any assumptions. Then stop and wait.
6. If something is ambiguous, state one assumption and continue. Do not ask questions
   unless blocked.
