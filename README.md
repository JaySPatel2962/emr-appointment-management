# EMR Appointment Management

Appointment management module for an enterprise EMR system. It covers role-based access (Super Admin, Receptionist, Doctor), doctor schedules, dynamically generated slots, booking that is safe against double booking, and real-time scheduler updates.

> **Status:** the backend (`server/`) is complete and tested (174 tests, about 92% line coverage). Design decisions are recorded in [`docs/decisions-notes.md`](docs/decisions-notes.md). The frontend hasn't been started.

## Tech stack

- **Server:** Node.js (>= 20.19), Express 5, MongoDB with Mongoose, zod, JWT, bcrypt, Socket.IO, TypeScript (strict)
- **Tooling:** tsx (development), tsc (build), ESLint and Prettier, Vitest with supertest and mongodb-memory-server

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
| `GET` | `/api/v1/patients?search=` | Super Admin, Receptionist | Search by patient code, the start of a mobile number or the start of a name. Without `search`, every patient, sorted by name. Paginated. |
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

`npm test` runs two kinds of test. Unit tests cover the pure logic: slot generation, schedule rules, the clinic timezone, validation, error mapping and input sanitising. Integration tests go through the real HTTP API with supertest, against a real MongoDB: an in-memory replica set, so indexes and transactions behave as in production. Tests never touch Atlas.

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

## Project structure

```text
server/
  src/      application code: config, constants, controllers, middlewares, models,
            routes, services, sockets, scripts, types, validators, utils
  tests/    unit/, integration/, helpers/
docs/       assessment brief and design decision notes
```

Server modules import each other through the `#app/*` alias (for example `#app/config/env.js`), which Node resolves natively through `package.json` `imports`.
