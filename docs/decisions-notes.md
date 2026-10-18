# Design decision notes

Running notes, phase by phase, for writing `ENGINEERING_DECISIONS.md`. Each entry gives the decision, then the reason.

## Phase 0: Tooling

- **Strict TypeScript everywhere.** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax` are on, and ESLint runs `typescript-eslint` `strictTypeChecked` with no `any` and no `@ts-ignore`. Why: nullability and shape bugs surface at compile time instead of in production. `verbatimModuleSyntax` plus `consistent-type-imports` keeps type-only imports out of the runtime code.
- **ESM with `module: NodeNext`.** Why: it is Node's native module system, and NodeNext makes TypeScript check imports exactly the way Node resolves them (explicit `.js` extensions).
- **Path alias through Node subpath imports (`#app/*` in `package.json` `imports`), not `tsconfig.paths` plus `tsc-alias`.** Why: Node resolves the alias natively at runtime, so the build never rewrites import paths. The `development` condition points at `src/*.ts` and is used by tsx, tsc and Vitest. The default condition points at `dist/*.js` for production. Dropping `tsc-alias` also removed 6 high-severity `npm audit` findings (its `braces` dependency has no fixed version) and a deprecated transitive package.
- **Versions pinned to what Node 20.19 and the linter support.** TypeScript is on 6.0 because typescript-eslint doesn't support TypeScript 7 yet. Vitest is on 4.1 because Vitest 5 requires Node 22. Node 20 has been end-of-life since April 2026, so moving to Node 22 or 24 LTS is recommended.
- **tsx for development, plain tsc for the build.** Why: tsx gives fast reloads without a bundler, and tsc output is easy to debug and needs no extra tooling.
- **Two Vitest projects: `unit` and `integration`.** Unit tests need no database. Integration tests share one mongodb-memory-server **replica set**, started once in `globalSetup`, because transactions need a replica set. Each test file gets its own randomly named database, so files run in parallel without interfering. Collections are emptied after each test and their indexes are kept. Tests never connect to Atlas.
- **LF line endings enforced** through `.gitattributes` and Prettier's `endOfLine: lf`. Why: Windows checkouts with `core.autocrlf` would otherwise fail `format:check`.
- **Secrets.** `.env` is gitignored, and `.env.example` contains placeholders only.

## Phase 1: Foundation

- **Fail-fast configuration.** `config/env.ts` validates every environment variable with zod at startup. If any is invalid, the server stops and lists the variable names, never their values. `MONGO_URI` and the two JWT secrets are required; everything else has a safe default. The JWT variables were added with auth in Phase 3 rather than here, so the app could start before auth existed. Tests never load `.env` (they take their values from `vitest.config.ts`), so a developer's Atlas credentials can't leak into a test run.
- **One response envelope** `{ success, message, data, meta }`, built in one place (`utils/api-response.ts`) for both successes and errors.
- **Central error mapping** in `utils/http-error.ts`, a pure function with its own unit tests:

  | Error | Response |
  | --- | --- |
  | `AppError` | its own status |
  | `ZodError` | 400, with one `{ field, message }` per issue |
  | Mongo duplicate key (11000) | 409, naming the field |
  | invalid ObjectId | 400 |
  | JWT errors | 401 |
  | malformed JSON | 400 |
  | oversized body | 413 |
  | anything else | 500 "Internal server error", logged with the request id |

  The stack trace is returned only in development.
- **Validated input in Express 5.** `req.query` is read-only in Express 5, so `validate(schema)` stores the parsed `{ body, query, params }` on `req.validated`, together with the schema that produced it. `getValidated(req, schema)` returns it typed from the schema, and throws if a controller asks with a different schema, which catches wiring mistakes.
- **NoSQL injection.** `express-mongo-sanitize` doesn't work with Express 5 because it reassigns `req.query`. Instead, three layers keep injected operators out of queries:
  - The "simple" query parser never builds nested objects.
  - zod validates every input.
  - `sanitizeInput` strips `$`-prefixed, dotted, `__proto__`, `constructor` and `prototype` keys from JSON bodies at any depth.
- **Security middleware:**
  - helmet.
  - CORS only for `CLIENT_URL`, with credentials. The origin is given as a list, so any other origin gets no `Access-Control-Allow-Origin` header at all.
  - A 100kb JSON body limit.
  - Per-IP rate limits: 300 requests per 15 minutes across the API, and 10 *failed* logins per 15 minutes (successful logins don't count).
  - A configurable `trust proxy`, so rate limits see real client IPs behind a load balancer.
- **Logging without secrets or patient data.** pino and pino-http write one line per request: request id, method, path, status and duration. The query string is left out because it can hold patient names and mobile numbers. Headers are not logged, and authorization, cookies, passwords and tokens are redacted wherever they appear. The MongoDB URI is never logged; a real startup log was scanned to confirm it.
- **Request ids.** Every request gets an `X-Request-Id`. A safe incoming id is reused; otherwise a UUID is generated. It is returned in the response header, in error bodies (`meta.requestId`) and in every log line, so an error a user reports can be traced.
- **Health check.** `GET /api/v1/health` returns 200 when MongoDB is connected and 503 otherwise, so a load balancer can take an unhealthy instance out of rotation.
- **`app.ts` and `server.ts` are separate.** `createApp()` builds the Express app with no side effects, so tests run it in-process with supertest. `server.ts` owns the process: it connects to MongoDB, listens, and shuts down gracefully on SIGINT or SIGTERM. Shutdown stops accepting connections, closes idle keep-alive connections, lets in-flight requests finish, closes MongoDB, and forces an exit after 10 seconds. Unhandled rejections and uncaught exceptions are logged and end the process, so a process manager restarts it cleanly.
- **The database connection.** MongoDB Atlas, reached through `MONGO_URI` in `server/.env`, which is gitignored.
  - The URI is never hardcoded, printed or logged, and no real value goes into a committed file. `.env.example` holds only a placeholder: `mongodb+srv://<user>:<password>@<cluster-host>/emr_appointments?retryWrites=true&w=majority`.
  - `config/db.ts` connects with a server-selection timeout (10 seconds by default), so a wrong URI or a blocked IP fails fast. The error message says what to check and never includes the URI. The driver's reason, which names the host but never the credentials, travels as the error's cause.
  - Shutdown closes the connection gracefully.
  - Tests use an in-memory replica set and never touch Atlas (see Phase 0).
- **Indexes.** `autoIndex` is on, so the partial unique index is created at startup. After connecting, the server waits for every model's index build and logs any failure with the model's name.
- **Status codes follow one set of rules.**
  - 404 when the resource in the URL doesn't exist, or the caller isn't allowed to know that it exists.
  - 422 when a well-formed request breaks a business rule: a slot the doctor doesn't offer, a past slot or date, an unknown department in the body.
  - 409 for a conflict with the current state: a taken slot, a status change the workflow doesn't allow, an email that is already used.
  - 400 only for input that fails validation.

## Phase 2: Models and indexes

- **Typed models.** Types are inferred from the Mongoose schemas (`InferSchemaType`), so a schema and its type can't drift apart. AuditLog is the exception: an explicit interface keeps its free-form `metadata` typed as `Record<string, unknown>` rather than `any`.
- **Dates and times are strings** (`"YYYY-MM-DD"` and `"HH:mm"`) in the clinic's timezone. A slot is a wall-clock time at one clinic, and strings say exactly that. They sort and compare correctly, never shift with the server's timezone or daylight saving, and make the double-booking index an exact match on `{ doctorId, date, slotStart }`.
- **Embedded or referenced.**
  - A doctor's weekly schedule is embedded: it is always read with the doctor, and has at most seven entries.
  - Appointments reference the patient, doctor, department and creator by id. They also copy the fields that lists need: patient code, name, lowercase name and mobile, and doctor name. List, search and sort then need no `$lookup`.
  - The trade-off: if a name changed later, old appointments would keep the old one. This module has no flows that edit those fields; a background job could sync them if it ever did.
- **One set of schedule rules** (`findScheduleProblems`), used by both the request validators and the Doctor model:
  - Each day appears once and has at least one session.
  - Every range starts before it ends.
  - Sessions may not overlap each other, nor may breaks. Ranges are half-open, so 09:00-12:00 and 12:00-13:00 touch without overlapping.
  - A break must fall within the day's working hours, either inside a session or in a gap between sessions. Gaps are allowed because the assessment's own example puts lunch (12:00-13:00) between the 09:00-12:00 and 13:00-17:00 sessions.
- **Patient codes** (`PAT-000001`) come from an atomic counter: a single `findOneAndUpdate` with `$inc` and `upsert`. Concurrent registrations always get distinct numbers (tested with 25 parallel calls). If a later step fails, a number may be skipped. That is fine for an id that only has to be unique and readable.
- **Mobile numbers** are Indian 10-digit numbers, since the clinic is in India (`Asia/Kolkata`). Input is normalized before saving (separators, `+91`, `91` or a leading `0` removed), so search always compares like with like. They are not unique, because family members often share a phone.
- **Case-insensitive uniqueness.** Emails are stored lowercase under a unique index. Department names use a unique index with a case-insensitive collation.
- **Name search uses a lowercase copy** (`nameLower`, `patientNameLower`), kept up to date by a small schema plugin. An anchored prefix query such as `/^asha/` on the copy uses an index. A text index can't match prefixes, and a case-insensitive regex can't use an index efficiently.
- **Sensitive fields.** `passwordHash` has `select: false` and is also stripped by `toJSON`. Refresh tokens are stored only as SHA-256 hashes.
- **Retention.** Refresh tokens have a TTL index on `expiresAt`, so MongoDB deletes them once they expire. Until then, revoked tokens stay on record so their reuse can be detected. Audit logs are append-only (`createdAt` only) and have no TTL, since medical audit trails are usually kept for years.
- **Indexes are ready before the first request.** Startup builds every model's indexes and waits for them before the server listens, so no booking can arrive before the double-booking index exists.

### Index rationale

| Collection | Index | Why |
| --- | --- | --- |
| appointments | `{ doctorId, date, slotStart }`, unique, partial on status SCHEDULED, ARRIVED or COMPLETED | The double-booking guard. Cancelled appointments are outside the index, so their slot can be rebooked. Tested: of 10 concurrent inserts, exactly 1 succeeds. |
| appointments | `{ doctorId, date }` | A doctor's appointments for a day or range: the doctor's own list and slot availability. The unique index can't serve these queries because it is partial. |
| appointments | `{ status, date }` | Status filter with a date range |
| appointments | `{ departmentId, date }` | Department filter with a date range |
| appointments | `{ date, slotStart }` | Lists filtered only by date range, sorted by date and time |
| appointments | `{ patientMobile }`, `{ patientNameLower }` | Patient search on the copied fields, as anchored prefix matches |
| patients | `{ patientCode }`, unique | Lookup by patient ID |
| patients | `{ mobile }`, `{ nameLower }` | Patient search by mobile number or name prefix |
| users | `{ email }`, unique | Login lookup, and one account per email |
| doctors | `{ userId }`, unique | One profile per user; finds the doctor at login |
| doctors | `{ departmentId, name }` | Doctor lists by department, sorted by name |
| departments | `{ name }`, unique, case-insensitive | No duplicate departments |
| refresh_tokens | `{ tokenHash }`, unique | Lookup on refresh |
| refresh_tokens | `{ userId }` | Revoking all of a user's tokens |
| refresh_tokens | `{ expiresAt }`, TTL | Expired tokens are deleted automatically |
| audit_logs | `{ createdAt: -1 }` | Most recent activity first |
| audit_logs | `{ entity, entityId, createdAt: -1 }` | The history of one record, newest first |

Every index exists because a query needs it, since each extra index slows writes slightly. Appointments carry seven, which is acceptable because they are read (lists, slot grids, searches) far more often than they are written.

## Phase 3: Authentication

- **Two tokens.** A short-lived access token (15 minutes) comes back in the response body; the frontend keeps it in memory and sends it as `Authorization: Bearer`. A refresh token (7 days) lives only in an httpOnly cookie, so no JavaScript, including an injected script, can read it.
- **The refresh cookie** is `HttpOnly`, `Secure`, `SameSite=Strict` (configurable for deployments where the frontend and API are on different sites) and `Path=/api/v1/auth`, so the browser sends it only to the auth endpoints. SameSite and the CORS allow-list protect `/refresh` and `/logout` against CSRF.
- **Both tokens are JWTs** (the assessment asks for a JWT refresh token), signed with HS256 using two different secrets and two audiences, so one can never be accepted as the other.
  - The algorithm is pinned when verifying, which rules out `alg: none`-style attacks.
  - After the signature check, the claims are validated with zod.
- **The access token carries the role and, for doctors, the doctor profile id.** Authenticating a request needs no database lookup, and the doctor-scoping rule has what it needs. The trade-off: deactivating a user takes effect when their access token expires, within 15 minutes. Refreshing checks `isActive` and fails at once.
- **Refresh tokens are stored as SHA-256 hashes**, together with expiry, revocation time, the hash of the replacing token, IP and user agent. A database leak exposes no usable token. A random `jti` makes every token unique.
- **Rotation with reuse detection.**
  - Every refresh revokes the old token and issues a new one.
  - If a revoked token is presented again, it must have been copied. Every session of that user is revoked and the event is audited as `REFRESH_TOKEN_REUSE`.
  - The old token is claimed with an atomic conditional update, so two simultaneous refreshes with the same token can't both succeed.
- **A failed refresh clears the cookie.** A refresh token that failed once will never work again, so the browser can drop it.
- **A failed login gives nothing away.**
  - An unknown email, a wrong password and a disabled account all get the same 401, "Invalid email or password". The audit log records the real reason.
  - An unknown email still runs a bcrypt comparison against a dummy hash, so response time doesn't reveal which emails exist.
  - Only failed logins count toward the login rate limit.
- **Passwords** use bcrypt with a configurable cost (12 by default; at least 10 is enforced in production). New passwords need 8 to 72 characters, including a letter and a number. 72 is bcrypt's limit, so longer passwords are refused rather than silently cut.
- **Audit entries** record successful and failed logins, logouts and token reuse, with IP and user agent. Audit writes are best effort: a failed write is logged as an error but never fails the user's action. A stricter design would write the entry in the same transaction, or through an outbox.
- **The seed script** creates the departments and the first Super Admin from env vars. It can run any number of times and never changes an existing admin's password. `npm run secrets` fills in the JWT secrets in `.env` without printing them.

## Phase 4: Users, doctors and departments

- **A doctor's account and profile are saved in one transaction:** both or neither. A test makes the profile insert fail and checks that no account is left behind. The password is hashed before the transaction starts, because bcrypt is slow and a transaction should stay short.
- **Duplicate emails are caught by the unique index** (409), not by looking first, so two simultaneous requests can't both create the same login.
- **Doctor scoping lives in the service.** For a doctor, `listDoctors` and `getDoctor` add the doctor's own id to the query. Another doctor's profile answers 404, not 403, so the ids of other profiles aren't confirmed.
- **No N+1 queries:** the departments for a whole page of doctors are loaded in one `$in` query.
- **Schedules are checked by the same rules twice.** zod returns a 400 with the exact field path of each problem, and the Mongoose validator (run on updates with `runValidators`) protects every other write path. When a schedule changes, already booked appointments are kept; flagging the ones that no longer fit is a future improvement.
- **Doctor search** is a case-insensitive "contains" on name and specialization. It can't use an index, which is fine at the size of a doctor list. User input is escaped before it becomes a regex, so it can't inject patterns.
- **Validators define the input types.** Services take `z.output<typeof schema>` types, so the shape of a request and the code that uses it can't drift apart.
- **Middleware order on every route:** authenticate, then authorize, then validate. Callers without access get 401 or 403 and never see validation details.

## Phase 5: Slot generation

- **Slots are computed, never stored.** For the requested date, take that weekday's sessions, remove the breaks, and cut what is left into back-to-back slots of the doctor's slot length. A remainder too short for a whole slot is dropped. After a break that doesn't line up with the slot grid, slots restart right at the break's end, so no time is lost. Storing slots would mean regenerating them whenever a schedule changes, and keeping them in sync.
- **`generateSlots` is a pure function**, with no database and no clock, so its edge cases are covered by fast unit tests: breaks at the start, middle and end of a session, a slot that ends exactly at a break, an off-grid break, a length that doesn't divide the session, sessions listed out of order, and a day off.
- **Two queries per request, whatever the number of slots:** one for the doctor, one for the day's active appointments. Appointments are matched to slots by start time through a map, so there is no N+1.
- **The clinic's clock.** "Today" and "now" come from luxon in `CLINIC_TIMEZONE`, so they are right whatever timezone the server runs in. The weekday comes from the calendar date alone. Asia/Kolkata has no daylight saving; luxon would also handle zones that do, although a slot falling inside a DST jump isn't treated specially.
- **Past rules.** A date before the clinic's today is rejected with 422. On today, a slot whose start time has been reached is PAST, because a slot that has already started can't be booked.
- **BOOKED wins over PAST.** A booked slot keeps its appointment id even after it starts, so a receptionist can still mark a late arrival.
- **Booking reuses the generator** (`resolveBookableSlot`), so the API can never book a time that the slot grid wouldn't offer: not in a break, not on a day off, not off the grid, not in the past.
- **A doctor asking for another doctor's slots gets 403, not 404.** A slot grid holds no private record, and a clear answer lets the frontend explain why. Records such as profiles and appointments answer 404 instead, so their ids aren't confirmed.
- **Known limitation:** if a schedule changes after appointments were booked, an appointment outside the new schedule no longer appears in the slot grid. It is still in the appointment list.

## Phase 6: Appointments and patients

- **Double booking: insert, and let the unique index decide.** There is no "is it free?" check before inserting, because two requests could both pass it. Booking for an existing patient is a single insert, and a duplicate key error on the slot index becomes 409 "Slot already booked".
- **A new patient and their appointment are saved in one transaction.** If the slot turns out to be taken, the transaction aborts and no orphan patient record is left (tested). The transaction helper retries the transient write conflicts that concurrent bookings cause.
  - The patient code is reserved from the counter before the transaction starts, so bookings don't all contend on one counter document.
  - A failed booking leaves a gap in the codes, which is harmless.
- **Bookable means "offered by the slot grid".** The service regenerates the doctor's slots for that date and requires an exact match on the start time, so a break, a day off, an off-grid time or a slot that has started gets a 422. The slot's end time and the department come from the server, never from the client.
- **Status changes are atomic.** Each change is a single `findOneAndUpdate` whose filter includes the statuses it may start from, taken from the transition map.
  - There is no read-then-write, so of two people acting at once only one succeeds.
  - An invalid move gets a 409 that names the current status.
  - Each change sets its timestamp (`arrivedAt`, `completedAt` or `cancelledAt`) and is audited.
- **Edit rules.**
  - The purpose can change while the appointment is SCHEDULED or ARRIVED.
  - Consultation notes can also change after it is COMPLETED.
  - Nothing changes once it is CANCELLED.
  - Doctors can only change notes, and get a 403 otherwise.
  - Cancelling is soft: DELETE keeps the record and frees the slot.
- **Workflow choices.**
  - An appointment can be completed only after the patient has arrived. A no-show is cancelled, not completed.
  - Arrival can be marked on any date, not only on the appointment day. A stricter clinic could require the dates to match.
- **Who sees patients.** Patient search is for Super Admins and receptionists. Doctors see a patient's details through their own appointments (`GET /appointments/:id`). Without a search term, the patient list shows everyone, sorted by name.
- **New patients.** The mobile number is normalized before saving, and a date of birth can't be in the future.
- **Notes are in the appointment list and detail,** which only signed-in staff can read, but never in Socket.IO events.
- **Doctor scoping is forced in the service**, in every query (list, detail, update, status change), not left to the controllers. A doctor's `doctorId` and `doctorName` filters are ignored, and another doctor's appointment gets a 404.
- **Filters are joined with `$and`**, one condition each, so no filter can overwrite another's field. The Phase 4 bug came from spreading two `_id` conditions into one object.
- **List performance.**
  - Patient name and mobile filters are anchored prefix regexes on indexed fields.
  - `doctorName` first finds the matching doctor ids (one small query), then filters on the indexed `doctorId`.
  - Sorting is allowed only on whitelisted fields (anything else is a 400), with `_id` as the final tiebreaker so pages never overlap.
  - Queries use `.lean()` and a projection, and `Promise.all` runs the page query and the count together.
- **Audit entries** for create (plus patient registration), update (field names only, never clinical text), arrive, complete and cancel.
- **Patient search** reads the term as a patient code (exact match), the start of a mobile number (normalized, with `+91` dropped) or the start of a name. Each is answered from an index.
- **Tests wait for the indexes,** as the server does at startup. A unique-email test once passed only because the index build happened to finish first. The test setup now waits for every index before any test runs, and the suite passed three runs in a row.

## Phase 7: Real-time updates

- **Socket.IO runs on the API's HTTP server and port.** That keeps one deployment unit, and CORS is limited to `CLIENT_URL`, as for the REST API.
- **Authentication happens in the handshake,** with the same access token (`auth: { token }`), and a connection without a valid token is refused. A socket can outlive its token, so the server disconnects it when the token expires and the client reconnects with a fresh one. A deactivated user therefore loses live updates within the token's lifetime, too.
- **One room per doctor and date** (`scheduler:{doctorId}:{date}`). A scheduler screen shows one doctor's day, so it receives only that day's changes: no firehose to filter on the client, and no other doctor's data reaches it.
  - Doctors can only join their own rooms, checked on join.
  - Super Admins are put in an `admin` room that receives everything.
- **Events are sent only after the write succeeds.** The appointment service publishes:
  - `appointment:created`
  - `appointment:updated`, for purpose or notes changes, arrival and completion
  - `appointment:cancelled`

  A failed or rejected change announces nothing (tested).
- **The emitter is injected (a port).** The service depends on a small `AppointmentEventEmitter` interface that is silent by default. The server plugs in the Socket.IO implementation at startup, and tests plug in a mock. The service knows nothing about Socket.IO, and HTTP-only tests need no socket server.
- **A failed broadcast never fails a request.** Publishing is wrapped and logged; the change is saved either way, and clients refetch when they reconnect.
- **Events carry no clinical notes.** The payload is the appointment summary without its notes; screens fetch details over HTTP when they need them.
- **Client input is untrusted.** Room requests are validated with zod, and the acknowledgement is called only if the client actually sent one, so a malformed message can't crash the server.
- **Scaling.** With more than one API instance, add the Socket.IO Redis adapter, so a change made on one instance reaches clients connected to another.

## Phase 8: Tests and quality

- **Test shape.** Pure functions (slot generation, schedule rules, clinic time, error mapping, sanitising) have unit tests. Everything else goes through the real HTTP API with supertest, against a real MongoDB (an in-memory replica set), so indexes, transactions and the order of middleware are all exercised.
- **Concurrency is tested through the API, not just the model.**
  - 10 parallel bookings of one slot: one 201 and nine 409s.
  - 5 racing new-patient bookings: one patient record.
  - Cancel, then 9 parallel rebookings: exactly one wins.
  - 2 parallel cancellations: one 200 and one 409.
- **RBAC is tested as a matrix:** every protected endpoint without a token, and every restricted endpoint against each role it excludes. The requests carry no body, which also proves that authorization runs before validation.
- **An end-to-end test** runs a whole clinic day through the API with real logins, then checks the audit trail entry by entry.
- **Determinism.**
  - Time-dependent tests fake only `Date`, so MongoDB's own timers keep running.
  - Each test file has its own database.
  - Tests wait for indexes before running.
  - The full suite passed three runs in a row.
- **Coverage:** about 92% of statements and lines, and 86% of branches (`npm run test:coverage`). Only the process entry point and one-off scripts are excluded.
- **Every commit passes the same gates:** Prettier, `tsc --noEmit`, ESLint `strictTypeChecked`, the whole test suite, and a production build.
- **What the tests caught:** the `_id` override in `getDoctor` (Phase 4), the index-build race in the test setup (Phase 6), and a test factory that pointed appointments at patients that didn't exist (Phase 8).

## Libraries and why

| Library | Why |
| --- | --- |
| Express 5 | The required framework. Version 5 also forwards rejected promises to the error handler. |
| Mongoose 9 | The required ODM: schemas, validation, index definitions and transactions |
| zod 4 | One schema per request gives both the validation and the TypeScript type |
| jsonwebtoken | Signs and verifies both tokens, with the algorithm pinned |
| bcrypt 6 | Password hashing with a tunable cost. Native and fast, with prebuilt binaries for Windows. |
| helmet, cors | Safe default headers, and CORS limited to the frontend's origin |
| express-rate-limit | Per-IP limits for the whole API and for failed logins |
| cookie-parser | Reads the httpOnly refresh cookie |
| pino, pino-http | Fast structured logs with built-in redaction |
| dotenv | Loads `server/.env` outside tests |
| luxon | Clinic-timezone dates and times without hand-written offset maths |
| Socket.IO 4 | Rooms, acknowledgements and reconnection out of the box for live updates |
| TypeScript 6, tsx | Strict types, fast development runs, and plain `tsc` for the build |
| ESLint, typescript-eslint, Prettier | Strict type-aware linting and consistent formatting |
| Vitest, supertest, mongodb-memory-server | Fast tests through the real HTTP API against a real, in-memory MongoDB replica set |
| socket.io-client | Real socket round trips in the tests |

## Confirmed product decisions

- Breaks can sit in the gap between two sessions, as long as they fall within the day's working hours (Phase 2).
- Mobile numbers are Indian 10-digit numbers, normalized before saving (Phase 2).
- The backend is TypeScript only, in strict mode, with MongoDB Atlas as the database.

## Judgment calls to confirm

Made without a specific instruction. Each is a small change if the clinic wants it different.

- Arrival can be marked on any date, not only on the appointment day (Phase 6).
- Consultation notes stay editable after a visit is completed; the purpose doesn't (Phase 6).
- Another doctor's records answer 404; another doctor's slot grid answers 403 (Phases 4 to 6).
- Audit writes are best effort and never fail the user's action (Phase 3).
- Socket.IO events never include clinical notes (Phase 7).
- Doctor search is a "contains" match on name and specialization; patient search is a prefix match (Phases 4 and 6).

## Known limitations and next steps

- Appointments booked before a schedule change stay valid even if they no longer fit. They should be flagged for review.
- The patient and doctor names copied onto appointments are not re-synced. No flows edit them yet.
- A deactivated user keeps API access until their access token expires, within 15 minutes.
- Audit writes are best effort. An outbox, or writing in the same transaction, would guarantee them.
- The server runs as one instance. Add the Socket.IO Redis adapter before running several.
- A slot inside a daylight-saving jump isn't handled specially. Asia/Kolkata has none.
- Not built yet: a dashboard summary endpoint, an audit log viewer, patient editing, OpenAPI documentation and Docker.
- Node 20 is end-of-life. Moving to Node 22 or 24 LTS also allows Vitest 5 and TypeScript 7.
- At much larger scale:
  - Archive past appointments by date.
  - Cache slot grids for a few seconds.
  - Move patient name search to Atlas Search.
  - Consider sharding appointments by doctor.

## Workflow

- One phase per commit on `feat/backend`, using conventional commits.
- Messages follow the 50/72 format and carry only the author's name, with no AI co-author lines. The git email is set for this repository only.
- Every commit passes the same gates: Prettier, type-check, lint, the whole test suite and a production build.
- `.env` is never committed.
