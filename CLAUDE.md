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
  - No inline styles.
- Every page has loading, empty and error states, and works at 375px, 768px and 1280px wide.
- Use `React.memo`, `useCallback` and `useMemo` only where they measurably help, such as slot grid cells and table rows. Record each one in `docs/decisions-notes.md`.
- Dates and times are the API's clinic-timezone strings (`"YYYY-MM-DD"`, `"HH:mm"`). Never turn them into a `Date` to display them.

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
- `npm run typecheck`: `tsc --noEmit` for the app (`tsconfig.json`) and the tool configs (`tsconfig.node.json`)
- `npm test`: Vitest unit and component tests (jsdom)
- `npm run test:coverage`: the tests plus a coverage report

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
- Done: 0 tooling (Vite, React, strict TypeScript, Tailwind, ESLint, Prettier, Vitest, env validated at startup)
- Next:
  - 1 foundation: typed API layer, axios refresh queue, auth, routing, layout, error handling
  - 2 reusable components
  - 3 pages
  - 4 performance and quality
  - 5 Playwright end-to-end tests against the real API
- Design decisions: the Frontend sections of `docs/decisions-notes.md`

### Client env vars (`client/.env.local`; see `client/.env.example`)
- `VITE_API_URL` (http://localhost:5000/api/v1): the REST API, including `/api/v1`. A path such as `/api/v1` also works behind a same-origin reverse proxy.
- `VITE_SOCKET_URL` (the origin of `VITE_API_URL`): the Socket.IO server
- Both are validated at startup, and both are public, because they're compiled into the bundle

## NOTE
- Never use niro for anything
