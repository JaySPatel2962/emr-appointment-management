# CLAUDE.md

## Project
Enterprise EMR appointment management module (MERN). Code quality and architecture matter more than feature count.

## Stack
- Server: Node (>= 20.19), Express 5, MongoDB, Mongoose, Socket.IO, zod, JWT, bcrypt
- Client: React 19 (Vite 8), React Router 7, TanStack Query 5, axios, react-hook-form + zod, socket.io-client, Tailwind CSS 4; Vitest + Testing Library
- TypeScript only, strict mode, no `any`, no `@ts-ignore`

## Structure
- `server/src/`: config, constants, controllers, middlewares, models, routes, services, sockets, scripts, types, validators, utils
- `server/tests/`: `unit/`, `integration/`, `helpers/`
- `client/src/`, organized by feature:
  - `app/`: providers, the router and the layout shell
  - `components/`: shared UI in `ui/`, plus `layout/` and `feedback/`
  - `features/<feature>/`: auth, dashboard, scheduler, booking, appointments, admin, plus doctors, departments and patients. Each has `api.ts`, `hooks/`, `components/`, `pages/` and `schemas.ts`.
  - `services/`: the HTTP client, the socket and the query client
  - `hooks/`, `utils/`, `types/`, `constants/`, `config/`, `styles/`, `test/`
- `client/e2e/`: Playwright specs; `support/` holds the test stack, seed data, fixtures and helpers

## Architecture rules
- Request flow: routes -> validators -> controllers -> services -> models
- Controllers stay thin; all business logic lives in services
- Wrap async controllers with `asyncHandler`
- Throw `AppError` for expected errors; handle everything in the `errorHandler` middleware
- Every API response uses `{ success, message, data, meta }`
- Use correct HTTP status codes (409 for double booking)
- API base path: `/api/v1`

## Backend rules
- Validate every request body, query, and params with zod; infer types from the schemas (`z.infer`)
- Services return plain typed objects, never Express `req`/`res`
- Dates are stored as `"YYYY-MM-DD"` strings and times as `"HH:mm"` strings, in the clinic timezone (`CLINIC_TIMEZONE`, default `Asia/Kolkata`)
- Use enums/const objects for roles and statuses, with no magic strings
- Use named exports; use `import type` for types
- Import server modules through the `#app/*` alias (e.g. `#app/config/env.js`), not long relative paths
- Never log secrets or tokens

## Frontend rules
- Components:
  - Functional components only. Type each component's props with an exported `XxxProps` interface, and don't use `React.FC`. The one class is the error boundary, because React requires a class for it.
  - No business logic in components. They render and wire up events. Data fetching, mutations, derived state and business rules live in hooks and in pure functions in `utils/`.
  - Build shared UI once in `src/components/ui/` and reuse it. Don't restyle the same element in several places.
- Folders: organize by feature. Each `src/features/<feature>/` owns its API calls (`api.ts`), hooks, components, pages and zod schemas.
- State and data:
  - Server state lives in TanStack Query, with query keys from each feature's key factory.
  - Context is for auth only. There is no global client-state store.
  - All HTTP goes through `src/services/http.ts`, which adds the access token and refreshes it; lint forbids importing axios anywhere else. API functions return the typed `data` (and `meta` for pages) from the response envelope.
- Forms use react-hook-form with zod schemas (`z.infer` types). Server field errors from `meta.errors` are mapped onto the form fields.
- Auth storage:
  - Keep the access token in memory only.
  - Never use `localStorage` or `sessionStorage` (lint-enforced).
  - The refresh token exists only as the httpOnly cookie.
- Imports and exports:
  - Named exports only, except in config files. Lazy-loaded routes import named exports too.
  - Import client modules through the `@/` alias (e.g. `@/services/http`).
- Accessibility:
  - Every control has a label, and semantic HTML comes first.
  - Focus is visible, and custom widgets work fully from the keyboard.
  - Async results are announced with `aria-live`.
  - Color is never the only signal.
- Styling:
  - Use Tailwind utilities with the design tokens in `src/styles/index.css` (`@theme`).
  - Component variants are typed maps, and classes are joined with `cn()`.
  - Don't pass a `className` that competes with a component's own classes. Add a variant instead.
  - A component that appears at more than one width uses container queries (`@container`, `@3xl:`).
  - No inline styles, except data-driven sizes such as a chart bar's width.
- Every page has loading, empty and error states, and works at 375px, 768px and 1280px wide.
- Use `React.memo`, `useCallback` and `useMemo` only where they measurably help, such as slot grid cells and table rows. Record each one in `docs/decisions-notes.md`.
- Dates and times are the API's clinic-timezone strings (`"YYYY-MM-DD"`, `"HH:mm"`). Never parse them with `new Date()` in the browser's timezone. Use the helpers in `src/utils/date.ts`, which work on UTC midnight, and `useClinicClock()` for "today" and "now" on the clinic's clock.

## Domain rules
- Roles: `SUPER_ADMIN`, `RECEPTIONIST`, `DOCTOR`; doctors see only their own appointments
- Appointment status flow: `SCHEDULED -> ARRIVED -> COMPLETED`, or `CANCELLED`
- Slots are generated dynamically, never stored, and never fall in breaks or the past
- Double booking is prevented by a partial unique index on `{ doctorId, date, slotStart }` (active statuses only)
- Log audit entries (user, role, action, entity, timestamp) for login and appointment create, update, cancel

## Code style
- Consistent naming, small reusable functions, no duplicated code
- Never return password hashes or tokens in responses
- Use `.lean()` for read queries; paginate, filter, and sort on the server

## Workflow
- Plan before coding; one feature per commit, using conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- Commit messages: a subject of at most 50 characters, imperative, lowercase after the type prefix, no trailing period (e.g. `feat: add slot generation`); then a blank line and a body wrapped at 72 characters that explains what changed and why
- Commits and PRs carry only the author's name: no `Co-Authored-By` trailers or AI attribution lines
- Never commit `.env`; keep `.env.example` updated
- Update `README.md` and `ENGINEERING_DECISIONS.md` as features land; record design decisions in `docs/decisions-notes.md`

## Commands
Server (run in `server/`):
- Setup: `npm install`, copy `.env.example` to `.env` and fill in the values, then `npm run secrets` and `npm run seed`
- `npm run dev`: start the API with auto-reload (tsx)
- `npm run build`, then `npm start`: compile to `dist/` with tsc and run the build
- `npm run lint` / `npm run format`: ESLint / Prettier
- `npm run typecheck`: `tsc --noEmit`
- `npm test`: Vitest unit and integration tests (integration tests use an in-memory MongoDB replica set, never Atlas)
- `npm run test:coverage`: the tests plus a coverage report
- `npm run secrets`: generate missing JWT secrets in `.env` (never printed)
- `npm run seed`: create the first Super Admin and the departments from env vars

Client (run in `client/`):
- Setup: `npm install`. The defaults point at the local API. To change them, copy `.env.example` to `.env.local`.
- `npm run dev`: start the app on http://localhost:5173, the API's default `CLIENT_URL`
- `npm run build`, then `npm run preview`: type-check and build to `dist/`, then serve the build on the same port
- `npm run lint` / `npm run format`: ESLint / Prettier
- `npm run typecheck`: `tsc --noEmit` for the app (`tsconfig.json`), the tool configs (`tsconfig.node.json`) and the end-to-end tests (`e2e/tsconfig.json`)
- `npm test`: Vitest unit and component tests (jsdom)
- `npm run test:coverage`: the tests plus a coverage report
- `npm run e2e`: Playwright end-to-end tests against the real API and a production build (see End-to-end tests below)
- `npm run e2e:ui` / `npm run e2e:report`: the same in Playwright's UI mode / the HTML report of the last run

## Backend status
All backend phases are done and committed on `feat/backend`: 174 tests pass, about 92% line coverage.
- Done: 0 tooling, 1 foundation (env, errors, security, health), 2 models and indexes, 3 auth, 4 doctors, receptionists and departments, 5 slot generation, 6 appointments and patients, 7 Socket.IO, 8 concurrency, RBAC and end-to-end tests
- Not done yet: `ENGINEERING_DECISIONS.md`, the README's assumptions, limitations and future sections, a git remote. The frontend's progress is under Frontend status below.
- Design decisions: `docs/decisions-notes.md`

### Response shapes
Every response is `{ success, message, data, meta }`. Errors have `data: null` and `meta: { requestId, errors?: [{ field, message }] }`. Paginated lists have `meta: { page, limit, total, totalPages }`, with `limit` at most 100.
- `User`: `{ id, name, email, role, doctorId? }`
- `Session`: `{ accessToken, tokenType: 'Bearer', expiresIn: 900, user: User }`
- `Department`: `{ id, name }`
- `DaySchedule`: `{ dayOfWeek: 0-6 (0 = Sunday), sessions: [{ start, end }], breaks: [{ start, end }] }`, times as `"HH:mm"`
- `Doctor`: `{ id, userId, name, specialization, department: Department, slotDurationMinutes, schedule: DaySchedule[] }`
- `DaySlots`: `{ doctorId, date, timezone, slotDurationMinutes, slots: [{ start, end, status: AVAILABLE | BOOKED | PAST, appointmentId? }] }`
- `Patient`: `{ id, patientCode, name, mobile, gender: MALE | FEMALE | OTHER, dateOfBirth: string | null }`
- `Appointment`: `{ id, patient: { id, patientCode, name, mobile }, doctor: { id, name }, departmentId, date, slotStart, slotEnd, purpose, notes, status, createdBy, arrivedAt, completedAt, cancelledAt, createdAt, updatedAt }`. The three status timestamps are `null` until set.

### Endpoints (under `/api/v1`)
SA = Super Admin, R = Receptionist, D = Doctor.

| Endpoint | Roles | Request | `data` |
| --- | --- | --- | --- |
| `GET /health` | public | | `{ status, database, uptimeSeconds, timestamp }`, 503 when the database is down |
| `POST /auth/login` | public | `{ email, password }` | `Session`; sets the refresh cookie |
| `POST /auth/refresh` | refresh cookie | | `Session`; rotates the cookie |
| `POST /auth/logout` | refresh cookie | | `null`; clears the cookie |
| `GET /departments` | all | | `Department[]` |
| `POST /users/receptionists` | SA | `{ name, email, password }` | `User` (201) |
| `POST /doctors` | SA | `{ name, email, password, departmentId, specialization, slotDurationMinutes, schedule? }` | `Doctor` (201) |
| `GET /doctors` | all; D sees only self | `?departmentId&search&page&limit` | `Doctor[]` |
| `GET /doctors/:id` | all; D only self | | `Doctor` |
| `PUT /doctors/:id/schedule` | SA | `{ schedule, slotDurationMinutes? }` | `Doctor` |
| `GET /slots` | all; D only own | `?doctorId&date&departmentId?` | `DaySlots` |
| `GET /patients` | SA, R | `?search&page&limit`: a patient code, the start of a mobile number, or the start of a name | `Patient[]` |
| `POST /appointments` | SA, R | `{ doctorId, date, slotStart, purpose, notes?, departmentId?, patientId }`, or `newPatient: { name, mobile, gender, dateOfBirth? }` instead of `patientId` | `Appointment` (201) |
| `GET /appointments` | all; D only own | `?page&limit&sortBy&sortOrder&status&doctorId&doctorName&departmentId&patientName&mobile&dateFrom&dateTo` | `Appointment[]` |
| `GET /appointments/:id` | all; D only own | | `Appointment`, with `patient` as a full `Patient` |
| `PUT /appointments/:id` | all; D notes only | `{ purpose?, notes? }` | `Appointment` |
| `DELETE /appointments/:id` | SA, R | | `Appointment` (CANCELLED) |
| `POST /appointments/:id/arrive` | SA, R | | `Appointment` (ARRIVED) |
| `POST /appointments/:id/complete` | SA, D (own) | | `Appointment` (COMPLETED) |

`sortBy` is `date` (the default), `createdAt`, `patientName`, `doctorName` or `status`. `sortOrder` is `asc` or `desc`.

Status codes:
- 400: validation failed
- 401: missing, invalid or expired token
- 403: the role is not allowed
- 404: not found, including another doctor's records
- 409: the slot is taken, the status change isn't allowed, or the email is already used
- 422: the slot isn't offered or has started, the date is past, or the department is unknown
- 429: rate limit

### Auth flow
- Login returns the access token in the body. It lasts 15 minutes; keep it in memory and send it as `Authorization: Bearer <token>`. Its claims are `sub`, `role`, and `doctorId` for doctors.
- The refresh token lasts 7 days and lives only in the `emr_refresh` cookie: httpOnly, Secure, SameSite=Strict, path `/api/v1/auth`.
- `POST /auth/refresh`, with credentials included (`withCredentials: true`), returns a new access token and rotates the cookie. Reusing an old refresh token revokes every session of that user.
- `POST /auth/logout` revokes the refresh token and clears the cookie.

### Socket.IO
- Same origin and port as the API. Connect with `io(url, { auth: { token: accessToken } })`. The socket closes when the token expires; reconnect with a fresh one.
- The client sends `scheduler:join` `{ doctorId, date }` with an acknowledgement that returns `{ ok: true, room }` or `{ ok: false, error }`, and `scheduler:leave` `{ doctorId, date }`.
- Rooms are `scheduler:{doctorId}:{date}`. Doctors can join only their own. Super Admins are joined to `admin` automatically and receive every event.
- After a change is saved, the server sends `appointment:created`, `appointment:updated` (purpose or notes changes, arrival, completion) or `appointment:cancelled`, with the `Appointment` minus `notes`.

### Env vars (`server/.env`; see `.env.example`)
- Required:
  - `MONGO_URI`
  - `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: at least 32 characters each, and different from each other. `npm run secrets` fills them in.
- Optional (default in brackets):
  - Server: `NODE_ENV` (development), `PORT` (5000), `LOG_LEVEL` (info)
  - Database: `MONGO_SERVER_SELECTION_TIMEOUT_MS` (10000)
  - Clinic and CORS: `CLIENT_URL` (http://localhost:5173), `CLINIC_TIMEZONE` (Asia/Kolkata)
  - Auth: `JWT_ACCESS_TTL_SECONDS` (900), `REFRESH_TOKEN_TTL_DAYS` (7), `REFRESH_COOKIE_SAMESITE` (strict), `BCRYPT_ROUNDS` (12)
  - Limits: `TRUST_PROXY_HOPS` (0), `BODY_LIMIT` (100kb), `RATE_LIMIT_WINDOW_MS` (900000), `RATE_LIMIT_MAX` (300), `LOGIN_RATE_LIMIT_MAX` (10)
- Seed script only: `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEPARTMENTS`

## Frontend status
The frontend is built on `feat/frontend` (branched from `feat/backend`), one phase per commit.
- Done:
  - 0 tooling: Vite, React, strict TypeScript, Tailwind, ESLint, Prettier, Vitest, and env validated at startup
  - 1 foundation:
    - design tokens
    - the typed API layer and `ApiError`
    - the axios refresh queue, with a cross-tab lock
    - the in-memory session, `AuthContext`, and silent refresh
    - route guards and lazy routes
    - the responsive shell
    - the error boundary, toasts, and the login, 403 and 404 pages
  - 2 reusable components, in `components/ui`: Button, ButtonLink, Input, PasswordInput, Textarea, Select, Checkbox, RadioGroup, DatePicker, Dialog, Modal, ConfirmDialog, Table, Pagination, Badge, Spinner, Skeleton, EmptyState, Alert, ErrorMessage, FormField, Tabs, Panel, DetailList
  - 3 pages:
    - dashboard: role-aware, from the existing list endpoint
    - scheduler: a live day sheet
    - booking: an existing or new patient, with 409 handling
    - appointment list: URL filters and row actions
    - staff and schedules: the schedule editor
  - 4 performance and quality:
    - vendor chunks
    - memoization proven by render-count tests (slot tiles, table rows)
    - component tests for the login form, ProtectedRoute and RoleRoute, the slot grid and the table
    - axe-core on 23 screen states, with no violations
    - scripted keyboard and focus checks
  - 5 end-to-end tests: 79 Playwright tests in `client/e2e/` covering auth, RBAC, the scheduler, booking, double booking, live updates, the list, row actions, admin, the dashboard, three screen widths, accessibility and render counts. Fixes they led to:
    - the list's text filters: two boxes edited in one pause both apply, "Clear filters" can't be undone by a search still waiting, and the boxes follow the URL when it changes elsewhere (`useTextFilters`)
    - a row action re-rendered every row's buttons; now only its own (`useIsActionPending`)
    - the date picker named a past day "no sessions"; it now says "unavailable", and its button is named by its label and date
- Design decisions: the Frontend sections of `docs/decisions-notes.md`

### End-to-end tests (`client/e2e/`)
- Run `npm run e2e` in `client/`. It needs `npm install` done in both `server/` and `client/`, and ports 5100 and 4173 free. No `.env` and no database are needed.
- What a run does:
  - Global setup (`e2e/global-setup.ts`) starts an in-memory MongoDB replica set with the database `emr_appointments_e2e`, runs the server's seed script, and starts the real API on :5100 with `NODE_ENV=test`. In test mode the server never reads `server/.env`, so the developer's data is never touched. The JWT secrets are generated for the run.
  - It seeds the clinic through the API (`e2e/support/seed.ts`): a receptionist, Dr. Kavya Mehta (Cardiology, every day 00:00-14:00 and 17:00-23:45, lunch 12:00-13:00) and Dr. Arjun Rao (Dermatology, Monday to Saturday, 10:00-14:00 and 17:00-20:00, lunch 12:20-13:00), eight patients, and 25 appointments for the list. The logins are in `e2e/support/seed-data.ts`.
  - Playwright builds the app into `dist-e2e/`, pointed at that API, and serves it with `vite preview` on :4173. The browser runs Chromium in en-IN on the clinic's timezone.
  - Afterwards the API stops and the database is dropped. The API's log is `client/test-results/api.log`; failures keep a trace and a screenshot in `test-results/`, and `npm run e2e:report` opens the HTML report with screenshots of each screen.
- Writing tests:
  - Import `test` and `expect` from `e2e/support/fixtures.ts`. Its `guard` fails a test on any console error or warning, uncaught exception, failed request or error response. A test that provokes one says so first: `guard.expectResponse(409, /\/appointments$/)`.
  - Find elements by role and accessible name, with the helpers in `e2e/support/app.ts`. Sign in with `openAs()` (an API login that leaves the refresh cookie), and open a second user's window with the `openWindow` fixture.
  - Each spec books on days of its own (`suiteDate()` in `e2e/support/dates.ts`), so the specs don't depend on each other or on their order. Seed in `beforeAll` with `ensureBooked()`, which survives a rerun.
  - `e2e/support/render-probe.ts` counts React renders in the production build, and `e2e/support/socket.ts` records Socket.IO events.

### Client env vars (`client/.env.local`; see `client/.env.example`)
- `VITE_API_URL` (http://localhost:5000/api/v1): the REST API, including `/api/v1`. A path such as `/api/v1` also works behind a same-origin reverse proxy.
- `VITE_SOCKET_URL` (the origin of `VITE_API_URL`): the Socket.IO server
- `VITE_CLINIC_TIMEZONE` (Asia/Kolkata): must match the server's `CLINIC_TIMEZONE`. It decides "today" and which slots are past.
- All are validated at startup, and all are public, because they're compiled into the bundle

### Client architecture
- `services/http.ts` has two axios clients. `authHttp`, for `/auth/*`, never sends or refreshes a token. `http`, for everything else, adds the bearer token and refreshes it on a 401. Concurrent 401s share one refresh, and the Web Locks API serializes refreshes across tabs.
- `services/auth-session.ts` holds the token and the user in memory, as an external store. `AuthProvider` exposes it and restores the session on load. Logout is broadcast to the other tabs.
- `services/socket.ts` holds one shared, reference-counted socket. Its `auth` callback supplies a fresh token on every connection attempt.
- Toasts are an external store too: call `toast.success(...)` from anywhere.
- Routes live in `app/router.tsx`, and the role lists are `ROUTE_ACCESS` in `constants/routes.ts`. The nav, in `app/navigation.ts`, uses the same lists.
- Data features: `departments`, `doctors`, `patients`, `slots` and `appointments`, each with `api.ts` and query keys.
  - `appointments/cache.ts` has `syncAppointment()`, which every change goes through, whether a mutation's response or a socket event.
  - `appointments/utils/permissions.ts` decides which row actions a role gets.
- The scheduler and the booking form share `useSlotSearch()`, which keeps `?doctor&date&slot` in the URL, and `useSchedulerRoom()`, the live room.
- Schedule rules for the editor live in `admin/utils/schedule-rules.ts`, mirroring the server's `utils/schedule.ts`.

## NOTE
- Never use niro for anything
