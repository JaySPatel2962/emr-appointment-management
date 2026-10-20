# EMR Appointment Management

Appointment management module for an enterprise EMR system. It covers role-based access (Super Admin, Receptionist, Doctor), doctor schedules, dynamically generated slots, booking that is safe against double booking, and real-time scheduler updates.

> **Status:**
> - The backend (`server/`) is complete and tested: 184 tests, about 93% line coverage.
> - The frontend (`client/`) is complete: login, dashboard, scheduler, booking, appointment list, and staff and schedules. 102 unit and component tests cover its logic, and 82 Playwright end-to-end tests run it against the real API.
> - A manual end-to-end QA pass, run like real clinic use against a real MongoDB, is written up in [`docs/MANUAL_TEST_REPORT.md`](docs/MANUAL_TEST_REPORT.md). It found nine bugs, all fixed, and lists the questions still open.
> - Design decisions are recorded in [`docs/decisions-notes.md`](docs/decisions-notes.md).

## Tech stack

- **Server:** Node.js (>= 20.19), Express 5, MongoDB with Mongoose, zod, JWT, bcrypt, Socket.IO, TypeScript (strict)
- **Client:** React 19 (Vite 8), React Router 7, TanStack Query 5, axios, react-hook-form with zod, socket.io-client, Tailwind CSS 4, TypeScript (strict)
- **Tooling:**
  - Server: tsx (development) and tsc (build); Vitest with supertest and mongodb-memory-server
  - Client: Vite; Vitest with jsdom and Testing Library; Playwright with axe-core for end-to-end tests
  - Both: ESLint and Prettier

## Getting started (server)

```bash
cd server
npm install
cp .env.example .env   # then set MONGO_URI and the SEED_ADMIN_* values
npm run secrets        # fills in the two JWT secrets in .env, without printing them
npm run seed           # creates the departments and the first Super Admin
npm run dev
```

## Scripts (server)

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API with auto-reload (tsx) |
| `npm run build` | Compiles TypeScript to `dist/` (tsc) |
| `npm start` | Runs the compiled build |
| `npm run seed` | Creates the first Super Admin and the departments from env vars |
| `npm run indexes:sync` | Makes the database's indexes match the models, dropping replaced ones. Run once after upgrading. |
| `npm run backfill:name-words` | Fills in the searchable name words of patients and appointments saved before word search. Run once after upgrading; safe to repeat. |
| `npm run secrets` | Generates any missing JWT secret in `.env`, without printing it |
| `npm run lint` | ESLint (type-aware) |
| `npm run format` | Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and integration tests (in-memory MongoDB replica set, never Atlas) |
| `npm run test:coverage` | The tests, plus a coverage report in `coverage/index.html` |

## Environment variables (server)

Copy `server/.env.example` to `server/.env`. Never commit `.env`.

The server validates these at startup and refuses to start if any are invalid, naming the variable but never printing its value.

| Variable | Description | Default |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test` or `production` | `development` |
| `PORT` | HTTP port | `5000` |
| `LOG_LEVEL` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` | `info` |
| `MONGO_URI` | MongoDB (Atlas) connection string | required |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | How long to wait for MongoDB at startup | `10000` |
| `CLIENT_URL` | Frontend origin allowed by CORS (with credentials) | `http://localhost:5173` |
| `CLINIC_TIMEZONE` | IANA timezone for all appointment dates and times | `Asia/Kolkata` |
| `JWT_ACCESS_SECRET` | Signs access tokens: at least 32 characters | required |
| `JWT_REFRESH_SECRET` | Signs refresh tokens: at least 32 characters, different from the access secret | required |
| `JWT_ACCESS_TTL_SECONDS` | Access token lifetime | `900` (15 minutes) |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh token lifetime | `7` |
| `REFRESH_COOKIE_SAMESITE` | `strict`, `lax` or `none`. Use `none` when the frontend and API are on different sites. | `strict` |
| `BCRYPT_ROUNDS` | bcrypt cost factor, at least 10 in production | `12` |
| `TRUST_PROXY_HOPS` | Reverse proxies in front of the API, so client IPs and rate limits are correct | `0` |
| `BODY_LIMIT` | Maximum JSON body size | `100kb` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 minutes) |
| `RATE_LIMIT_MAX` | Requests per client IP per window, across the API | `300` |
| `LOGIN_RATE_LIMIT_MAX` | Failed logins per client IP per window | `10` |

## Frontend overview

| Screen | Who | What it does |
| --- | --- | --- |
| Login | everyone | Email and password. A reload keeps you signed in, through a silent refresh with the httpOnly cookie. |
| Dashboard | everyone | Today by status (still to come, waiting, completed, cancelled), who is waiting and who is next. A doctor sees only their own day; a Super Admin also sees each doctor's load. |
| Scheduler | everyone | One doctor's day as a sheet of slots, laid out by session, with breaks shown. Available slots link to booking, booked ones open the appointment, and past ones are hatched. It updates live over Socket.IO. |
| Book appointment | Super Admin, Receptionist | Choose a doctor, day and free slot, then find the patient by ID, mobile or name, or register a new one. A slot someone else just took is caught (409) and the slots refresh. |
| Appointments | everyone | Server-side paging, sorting and filters (patient, mobile, doctor, department, status, dates), kept in the URL. Row actions depend on the role: check in, complete, edit, cancel. |
| Staff and schedules | Super Admin | Add doctors and receptionists, and edit each doctor's working days, sessions, breaks and slot length. |

## Getting started (client)

Start the API first (see above), then:

```bash
cd client
npm install
npm run dev            # http://localhost:5173, the origin the API allows by default (CLIENT_URL)
```

The defaults expect the API at `http://localhost:5000`. To point the app somewhere else, copy `client/.env.example` to `client/.env.local` and edit it.

## Scripts (client)

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the app with hot reload on port 5173 |
| `npm run build` | Type-checks, then builds for production into `dist/` |
| `npm run preview` | Serves the production build on port 5173 |
| `npm run lint` | ESLint: type-aware, plus React Hooks, accessibility and TanStack Query rules |
| `npm run format` | Prettier, which also sorts Tailwind classes |
| `npm run typecheck` | `tsc --noEmit` for the app, the tool configs and the end-to-end tests |
| `npm test` | Vitest unit and component tests (jsdom) |
| `npm run test:coverage` | The tests, plus a coverage report in `coverage/index.html` |
| `npm run e2e` | Playwright end-to-end tests: the real API on an in-memory database, and a production build of the app |
| `npm run e2e:ui` | The end-to-end tests in Playwright's UI mode, to watch or debug them |
| `npm run e2e:report` | Opens the HTML report of the last end-to-end run, with screenshots |

## Environment variables (client)

All three are optional. They are checked when the app starts, and an invalid one stops it with the variable's name. They're compiled into the JavaScript bundle, so they're public: never put a secret in them.

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_API_URL` | Base URL of the REST API, including `/api/v1`. A path such as `/api/v1` also works when a reverse proxy serves the API from the app's origin. | `http://localhost:5000/api/v1` |
| `VITE_SOCKET_URL` | Origin of the Socket.IO server | The origin of `VITE_API_URL` |
| `VITE_CLINIC_TIMEZONE` | IANA timezone of the clinic. It must match the server's `CLINIC_TIMEZONE`, so "today" and past slots follow the clinic's clock rather than the browser's. | `Asia/Kolkata` |

## API Documentation

The full API reference is in [`docs/API.md`](docs/API.md). It covers:
- every endpoint: roles, parameters, validation rules, a curl example, and real success and error responses
- the roles and permissions matrix, including how doctors are limited to their own records
- the appointment status workflow, the slot rules and concurrency
- pagination, sorting and filtering
- the Socket.IO events and their payloads
- every error code, and the rate limits

A Postman collection (v2.1) with every endpoint is in [`docs/postman_collection.json`](docs/postman_collection.json). To use it:
1. Import it, and set `adminEmail` and `adminPassword` to the Super Admin from `npm run seed`. `baseUrl` defaults to `http://localhost:5000/api/v1`.
2. Run **Auth > Log in** first. It stores the access token in `accessToken`, which every other request sends.
3. The folders run top to bottom: each request stores the ids it creates for the ones that follow.

## API conventions

Base path: `/api/v1`. Every response, success or error, uses the same envelope:

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": { "status": "ok", "database": "up" },
  "meta": {}
}
```

Lists are paginated with `page` (default 1) and `limit` (default 20, at most 100), and their `meta` is `{ "page", "limit", "total", "totalPages" }`.

Errors have `success: false` and `data: null`. `meta.requestId` matches the `X-Request-Id` response header, and validation errors list each problem in `meta.errors` as `{ "field": "body.email", "message": "Must be a valid email address" }`.

| Status | When |
| --- | --- |
| 400 | Invalid input: failed validation, malformed JSON, or an invalid id |
| 401 | Missing, invalid or expired token |
| 403 | Authenticated, but the role is not allowed |
| 404 | Unknown route or resource |
| 409 | Conflict, for example a slot that is already booked |
| 413 | Request body larger than `BODY_LIMIT` |
| 422 | Valid input that breaks a business rule, for example a slot in the past |
| 429 | Rate limit exceeded |
| 500 | Unexpected error. Details are logged with the request id and never returned. |
| 503 | Health check only: the database is unavailable |

### Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` | none | Service and database status: 200, or 503 when the database is down |
| `POST` | `/api/v1/auth/login` | none | Email and password. Returns an access token and sets the refresh cookie. |
| `POST` | `/api/v1/auth/refresh` | refresh cookie | Returns a new access token and rotates the refresh token |
| `POST` | `/api/v1/auth/logout` | refresh cookie | Revokes the refresh token and clears the cookie |
| `GET` | `/api/v1/departments` | any role | All departments, sorted by name |
| `POST` | `/api/v1/users/receptionists` | Super Admin | Creates a receptionist account |
| `POST` | `/api/v1/doctors` | Super Admin | Creates a doctor's account and profile together |
| `GET` | `/api/v1/doctors` | any role | Doctors, filtered by `departmentId` and `search` and paginated. A doctor sees only themselves. |
| `GET` | `/api/v1/doctors/:id` | any role | One doctor with their schedule. A doctor can only fetch their own profile. |
| `PUT` | `/api/v1/doctors/:id/schedule` | Super Admin | Replaces the weekly schedule, and optionally the slot length |
| `GET` | `/api/v1/slots?doctorId=&date=` | any role | A doctor's slots for one date, each `AVAILABLE`, `BOOKED` (with the appointment id) or `PAST`. Optional `departmentId`. Past dates are rejected, and a doctor can only see their own slots. |
| `GET` | `/api/v1/patients?search=` | Super Admin, Receptionist | Search by patient code, the start of a mobile number, or the start of any word of the name. Without `search`, every patient, sorted by name. Paginated. |
| `POST` | `/api/v1/appointments` | Super Admin, Receptionist | Books a slot for an existing patient (`patientId`) or registers a new one (`newPatient`) |
| `GET` | `/api/v1/appointments` | any role | Filtered, sorted and paginated list (see below). A doctor sees only their own appointments. |
| `GET` | `/api/v1/appointments/:id` | any role | One appointment with the patient's details |
| `PUT` | `/api/v1/appointments/:id` | any role | Updates `purpose` and `notes`. Doctors can only update notes. |
| `DELETE` | `/api/v1/appointments/:id` | Super Admin, Receptionist | Cancels the appointment, which stays on record, and frees the slot |
| `POST` | `/api/v1/appointments/:id/arrive` | Super Admin, Receptionist | Marks the patient as arrived (SCHEDULED to ARRIVED) |
| `POST` | `/api/v1/appointments/:id/complete` | Super Admin, Doctor | Completes the visit (ARRIVED to COMPLETED) |

### Booking an appointment

```json
{
  "doctorId": "6711a2f4c1d2e3f4a5b6c7b2",
  "date": "2026-10-20",
  "slotStart": "09:15",
  "purpose": "Follow-up",
  "notes": "Optional",
  "patientId": "6711a2f4c1d2e3f4a5b6c7a1"
}
```

For a new patient, send `"newPatient": { "name": "Asha Rao", "mobile": "98765 43210", "gender": "FEMALE", "dateOfBirth": "1990-05-14" }` instead of `patientId`. The slot's end time and the department come from the doctor's schedule.

- A taken slot answers 409 "Slot already booked".
- A time the doctor doesn't offer (a break, a day off, a time off the slot grid) or a slot that has already started answers 422.

### Appointment workflow

SCHEDULED, then ARRIVED, then COMPLETED. A SCHEDULED or ARRIVED appointment can also be CANCELLED. Any other move answers 409.

The purpose can change until the visit is completed, and the notes can change until the appointment is cancelled.

### Appointment list

`GET /api/v1/appointments` takes:

- `page`, `limit`
- `sortBy`: `date` (the default, then by time), `createdAt`, `patientName`, `doctorName` or `status`. `sortOrder`: `asc` (the default) or `desc`.
- `status`, `doctorId`, `departmentId`
- `dateFrom` and `dateTo`, inclusive, as `YYYY-MM-DD`
- `patientName` (the start of the name), `mobile` (the start of the number) and `doctorName` (any part of the name)

### Authentication

Send the access token as `Authorization: Bearer <accessToken>`. It lasts 15 minutes. To get a new one, call `POST /api/v1/auth/refresh` with credentials included (`credentials: 'include'` in `fetch`, `withCredentials: true` in axios), so the browser sends the httpOnly refresh cookie. Each refresh replaces the refresh token. Presenting an old one again ends every session of that user.

The seed script also reads `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and `SEED_DEPARTMENTS` (see `.env.example`).

## Real-time updates

Socket.IO runs on the API's own port. Connect with the access token, then join the scheduler you are showing:

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', { auth: { token: accessToken } });

socket.emit('scheduler:join', { doctorId, date: '2026-10-20' }, (result) => {
  // { ok: true, room } or { ok: false, error }
});
socket.on('appointment:created', (appointment) => {});
socket.on('appointment:updated', (appointment) => {});
socket.on('appointment:cancelled', (appointment) => {});
```

- **Rooms:** there is one room per doctor and date, named `scheduler:{doctorId}:{date}`. Send `scheduler:leave` when the screen moves to another doctor or date.
- **Who can join what:** doctors can only join their own scheduler. Super Admins receive every change without joining anything.
- **Events:** each event carries the appointment without its notes, and is sent only after the change has been saved.
- **Token expiry:** the connection closes when the access token expires. Reconnect with a fresh one, for example after calling `/auth/refresh`.

## Database design

The full design is in [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md). It covers:
- every collection's fields, with a sample document
- the ER diagram
- each index and the query it serves
- the booking, status and auth flows
- measured query plans
- how the design would scale

A visual version with the same content is in `docs/` as [`docs/database-design.html`](docs/database-design.html). Open it in a browser. Its diagrams load Mermaid from a CDN, so they need an internet connection.

MongoDB with Mongoose. How the collections relate:

```mermaid
erDiagram
    USERS ||--o| DOCTORS : "has a profile"
    DEPARTMENTS ||--o{ DOCTORS : "has"
    DOCTORS ||--o{ APPOINTMENTS : "sees"
    PATIENTS ||--o{ APPOINTMENTS : "books"
    DEPARTMENTS ||--o{ APPOINTMENTS : "groups"
    USERS ||--o{ APPOINTMENTS : "creates"
    USERS ||--o{ REFRESH_TOKENS : "signs in with"
    USERS |o--o{ AUDIT_LOGS : "performs"
```

| Collection | What it stores |
| --- | --- |
| `users` | Staff accounts: name, email (unique), role, active flag, and the bcrypt password hash, which is never returned |
| `departments` | Department names (unique, case-insensitive) |
| `doctors` | Doctor profiles: user, department, name, specialization, slot length, and the weekly schedule of working days with sessions and breaks |
| `patients` | Patient code (`PAT-000001`), name, mobile, gender and date of birth |
| `appointments` | Patient, doctor, department, date, slot, purpose, notes, status with a timestamp per status change, plus copies of the patient's and doctor's names for search |
| `audit_logs` | Who did what to which record, and when (append-only) |
| `refresh_tokens` | Hashed refresh tokens with expiry, revocation and rotation |
| `counters` | Atomic sequences, used for patient codes |

A sample appointment:

```json
{
  "_id": "6711a2f4c1d2e3f4a5b6c7d8",
  "patientId": "6711a2f4c1d2e3f4a5b6c7a1",
  "doctorId": "6711a2f4c1d2e3f4a5b6c7b2",
  "departmentId": "6711a2f4c1d2e3f4a5b6c7c3",
  "date": "2026-10-20",
  "slotStart": "09:15",
  "slotEnd": "09:30",
  "purpose": "Follow-up",
  "notes": "",
  "status": "SCHEDULED",
  "createdBy": "6711a2f4c1d2e3f4a5b6c7e4",
  "patientCode": "PAT-000042",
  "patientName": "Asha Rao",
  "patientNameLower": "asha rao",
  "patientMobile": "9876543210",
  "doctorName": "Dr. Kavya Mehta",
  "createdAt": "2026-10-17T10:02:11.000Z",
  "updatedAt": "2026-10-17T10:02:11.000Z"
}
```

Double booking is prevented by a unique index on `{ doctorId, date, slotStart }` that covers only active appointments, so a cancelled slot can be booked again. Every index, the query it serves and the reason for it are listed in [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md#5-indexes).

## Testing

### Server

`npm test` in `server/` runs two kinds of test. Unit tests cover the pure logic: slot generation, schedule rules, the clinic timezone, validation, error mapping and input sanitising. Integration tests go through the real HTTP API with supertest, against a real MongoDB: an in-memory replica set, so indexes and transactions behave as in production. Tests never touch Atlas.

The integration tests prove the guarantees that matter:

- **Double booking:**
  - Of 10 simultaneous bookings of one slot, exactly 1 succeeds and 9 get 409.
  - When new-patient bookings race for a slot, exactly one patient record is created.
  - A cancelled slot can be booked again.
  - Of two simultaneous cancellations, one succeeds and one gets 409.
- **Authentication:** login, refresh token rotation, reuse detection that ends every session, and logout.
- **Access control:** every protected endpoint answers 401 without a token, and every restricted endpoint answers 403 to each role it excludes.
- **Doctor scoping** across doctors, slots and appointments.
- **Real-time events** over a real Socket.IO connection.
- **A whole clinic day** with real logins, from creating staff to completing a visit, including the audit trail.

### Client

`npm test` in `client/` runs Vitest with Testing Library: the refresh queue, env validation, dates and the calendar, schedule rules, booking requests, the list's search boxes, and components such as the login form, the route guards, the slot grid and the table. Two of them count renders to prove the memoization works: a live update re-renders one slot tile, and a changed row re-renders one table row.

`npm run e2e` in `client/` runs 85 Playwright tests in Chromium against the real API. Before the first test, global setup starts an in-memory MongoDB with its own database (`emr_appointments_e2e`) and the API on port 5100 in test mode, which never reads `server/.env`. It then seeds a clinic through the API: two doctors with morning and evening sessions and a lunch break, a receptionist and eight patients. Playwright serves a production build of the app on port 4173. Nothing touches your own database, and no `.env` is needed; ports 5100 and 4173 must be free.

What the end-to-end tests check:

- **Auth:** each role's login, a wrong password, the redirect back after login, a reload keeping the session, logout (in every tab), an expired access token renewed silently, and no token in web storage
- **Access by role:** each role's menu, the 403 page for another role's page, a doctor seeing only their own appointments, and the 404 page
- **Scheduler:** department and doctor filters kept in the URL, past days that can't be chosen, past, free and booked slots that look different, no slots in breaks, a doctor's day off, and the clinic's clock deciding "today" whatever the browser's timezone
- **Booking:** finding a patient by ID, mobile or name, a debounced search, registering a new patient, the "Is it one of these?" hint for a registered mobile number, validation, the confirmation, and the slot showing as booked
- **Double booking:** two windows book one slot at the same moment; exactly one succeeds, and the other is told and sees the slot taken
- **Live updates:** a booking, an update and a cancellation in another window appear without a reload; a window that changes day or page leaves the old room
- **Appointment list:** paging and sorting on the server, every filter, the typing pause, the URL kept across a reload, and the loading, empty and error states
- **Row actions:** edit, check in, cancel after a confirmation, an action someone else got to first (409), rebooking a cancelled slot, and a doctor completing a visit and writing notes only
- **Staff and schedules:** adding a receptionist and a doctor, and editing a schedule with its overlap and working-hours errors
- **Layout and quality:** no sideways scrolling at 375, 768 and 1280 px, axe-core (WCAG 2.2 AA) on every page and dialog, keyboard and focus behavior, and render counts in the production build (a live change re-renders one tile; an action on a row re-renders that row)
- **Every test** fails on a console error or warning, an uncaught exception, a failed request or an unexpected error response.

## Project structure

```text
server/
  src/      application code: config, constants, controllers, middlewares, models,
            routes, services, sockets, scripts, types, validators, utils
  tests/    unit/, integration/, helpers/
client/
  src/      app/ (providers, router, layout), components/ (shared UI),
            features/ (auth, dashboard, scheduler, booking, appointments, admin),
            services/ (HTTP, socket, query client), hooks/, utils/, types/,
            constants/, config/, styles/, test/
  e2e/      Playwright specs; support/ holds the stack, seed data, fixtures and helpers
docs/       assessment brief and design decision notes
```

Server modules import each other through the `#app/*` alias (for example `#app/config/env.js`), which Node resolves natively through `package.json` `imports`. Client modules use the `@/` alias (for example `@/config/env`), which Vite and TypeScript resolve.

## Assumptions

Where the brief left room for interpretation, this build assumes the following. The questions behind them are in [`docs/MANUAL_TEST_REPORT.md`](docs/MANUAL_TEST_REPORT.md) (Q-01 to Q-07).

- **A doctor may have no working days (Q-01).** An empty week (`schedule: []`) is accepted when a doctor is created and when a schedule is edited, for a doctor who is on leave or whose hours aren't known yet. Such a doctor is listed but offers no slots on any day. The brief lists "no working days" among invalid schedules; this build reads it as "no bookable day", not as an error.
- **Mobile numbers aren't unique (Q-02).** Families often share one phone, so two patients may have the same number. The new-patient form lists the patients already registered with a number ("Is it one of these?"), but never refuses to register.
- **Unknown query parameters are ignored (Q-05).** Query strings are parsed flat, so `?search[$gt]=x` is a parameter literally named `search[$gt]`. No endpoint knows it, so it is dropped like any unknown parameter, and the request runs without it. It is never read as a MongoDB operator. JSON bodies are stricter: keys that start with `$` or contain `.` are removed, and deep nesting gets 400.
- **Every date and time is the clinic's.** Dates and times are wall-clock values in `CLINIC_TIMEZONE`, and "today" and "now" come from the clinic's clock, whatever the browser's timezone.

## Known limitations

- **No booking horizon (Q-04).** Any future day the doctor works can be booked, even years ahead (a slot in 2099 is accepted). A clinic that wants a limit would add a configurable horizon, such as 90 days, answered with 422.
- **An empty week gives no warning (Q-01).** The schedule editor saves a week with every day switched off without asking first, and the doctor then has no slots until a day is added back.
- **Operator-looking query parameters get 200, not 400 (Q-05).** `?search[$gt]=` or `?status[$ne]=CANCELLED` runs as if the parameter weren't there: nothing is injected, but nothing is refused either. Strict query schemas, which reject unknown parameters with 400, would be the change if a client needs to be told.
