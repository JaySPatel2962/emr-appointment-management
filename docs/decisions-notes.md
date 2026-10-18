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

## Frontend Phase 0: Tooling

- **A separate `client/` package**, like `server/`, with its own dependencies, scripts and lockfile. Why: the two are deployed and upgraded independently, and no server code can end up in the browser bundle.
- **Vite 8, React 19 and strict TypeScript 6.** The client uses the server's compiler flags (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). They live in one `tsconfig.base.json`, which two configs extend: `tsconfig.json` for the app, with DOM types, and `tsconfig.node.json` for the tool configs, with Node types. So browser code can't use a Node global by mistake.
- **Versions are pinned to what Node 20.19 supports**, as on the server:
  - React Router 7, because version 8 requires Node 22
  - Vitest 4.1, jsdom 29 and jest-dom 6.9, because their next versions also require Node 22
  - TypeScript 6.0, because typescript-eslint doesn't support 7 yet
- **Tailwind CSS 4 rather than CSS Modules.** Why:
  - Design tokens (colors, the status palette, type, spacing) are defined once, in CSS `@theme`, and every utility uses them, so spacing and colors stay consistent.
  - Responsive (`sm:`, `md:`, `lg:`), `focus-visible:` and `motion-reduce:` variants are built in. That makes mobile-first layouts and accessible focus states cheap.
  - It has no runtime cost, and the build keeps only the classes in use. The placeholder page needs 5 KB of CSS.
  - Class lists live inside the reusable components, so pages compose components rather than repeat classes.
  - CSS Modules would need a hand-written media query in every file. And with `noUncheckedIndexedAccess`, every class lookup would be typed `string | undefined`, so a mistyped class name wouldn't be caught.
- **TanStack Query for server state, React Context for auth only.**
  - Almost all of this app's state is server data: slots, appointments, doctors.
  - TanStack Query caches it, merges duplicate requests and refetches stale data. It also gives every screen its loading and error states.
  - Socket events can update or invalidate the cache directly.
  - The only state left that the whole app shares is the session, and Context handles it without a store library such as Redux or Zustand.
- **react-hook-form with zod.** zod is the server's validation library as well, so the client's rules read like the server's, and form types come from `z.infer`. react-hook-form keeps inputs uncontrolled, so typing doesn't re-render the whole form.
- **axios rather than fetch.** Its interceptors are the natural place to add the bearer token and to refresh it once on a 401, and `withCredentials` sends the refresh cookie. A lint rule forbids importing axios outside `src/services/`, so every request goes through those interceptors.
- **No browser storage.** ESLint bans `localStorage` and `sessionStorage`, so the access token can't be persisted by accident. It lives in memory, and after a page reload the app gets a new one from the httpOnly refresh cookie.
- **Lint rules beyond the server's.** These come from plugins:
  - React Hooks, including the React Compiler checks such as purity and no `setState` inside effects
  - React Refresh
  - TanStack Query: complete query keys and a stable client
  - Accessibility, using the strict preset. The rules come from `eslint-plugin-jsx-a11y-x`, a maintained fork. The original plugin supports ESLint only up to 9, and the repository is on ESLint 10.
- **The `@/` import alias** (for example `@/services/http`) is resolved by Vite and by TypeScript `paths`. The server uses Node subpath imports (`#app/*`) instead, only because Node runs it without a bundler.
- **The API's location comes from env vars that are validated at startup.**
  - `VITE_API_URL` and `VITE_SOCKET_URL` are checked with zod. An invalid value stops the app and names the variable, never its value.
  - `VITE_SOCKET_URL` defaults to the API's origin.
  - `VITE_` values are compiled into the public bundle, so nothing secret goes in them.
- **The browser calls the API directly**, at `http://localhost:5000/api/v1`, and the server's CORS allow-list (`CLIENT_URL`) admits it. There is no dev-server proxy. Why: this is the setup API.md documents, and a production build works the same way.
  - The refresh cookie still flows. `localhost:5173` and `localhost:5000` are the same site, so the `SameSite=Strict` cookie is sent. Browsers treat `http://localhost` as secure, so the `Secure` cookie is kept.
  - The cost is a CORS preflight before each request that carries the `Authorization` header. In production, a reverse proxy that serves both under one origin (`VITE_API_URL=/api/v1`) removes it.
- **`dev` and `preview` both use port 5173**, with `strictPort`, because CORS allows exactly one origin.

## Frontend Phase 1: Foundation

### Design direction

- **Subject.** The front desk and consulting rooms of a multi-department clinic in India. Receptionists book, check in and answer the phone all day; doctors glance at their own day; a Super Admin sets things up. The app's main job is to show a doctor's day as time, and to turn an open slot into a booked visit in seconds without double booking.
- **The look is a clinic day sheet**: ballpoint-ink navy text on cool paper, and the blue of a carbon-copy appointment slip for what is booked and for primary actions. The tokens are in `src/styles/index.css`:

  | Token | Hex | Used for |
  | --- | --- | --- |
  | ink | `#172238` | text |
  | canvas, paper | `#edf1f4`, `#ffffff` | page background, surfaces |
  | carbon | `#2b3990` | booked slots, scheduled visits, primary actions, focus |
  | leaf | `#17704a` | available slots, completed visits |
  | saffron | `#9a4a06` | arrived (waiting) patients |
  | vermilion | `#b0261e` | cancelled visits, destructive actions, errors |
  | slate | `#5a6475` | slots in the past, drawn hatched |

  Every text pairing was measured at 4.5:1 or better, and input borders at 3:1 against paper. Tailwind's default palette is switched off (`--color-*: initial`), so only these colors can be used.
- **One typeface: Atkinson Hyperlegible Next**, self-hosted through Fontsource. The Braille Institute designed it so that look-alike characters stay distinct: `0` and `O`, `1`, `l` and `I`. In this app people read patient codes (`PAT-000001`), mobile numbers and times (`09:15`) all day, often in a hurry, so that is the property that matters. Its tabular figures (`tnum`) keep times lined up in columns.
- **One bold element: the slot grid.** The login page shows a sample day sheet. Everything else is quiet: hairline borders, a different corner radius per level (tiles 6px, controls 8px, panels 12px), and shadows only on things that float (dialogs, toasts).
- **Checked against the generic defaults** that the frontend-design guidance lists:
  - Avoided: a cream background with terracotta, a near-black background with one acid accent, identical rounded cards with grey shadows, ALL-CAPS eyebrow labels, `A · B · C` metadata strings, monospace data labels, and `→` on buttons.
  - Changed after review: the primary color started close to Tailwind's `indigo-600`, the stock SaaS blue. It was darkened and desaturated to carbon `#2b3990`.
- **Copy.** Sentence case and plain verbs. A button says exactly what it does ("Log in", "Book appointment", "Mark as arrived"), and its toast uses the same words. Errors say what happened and what to do, without apologizing.

### Architecture

- **A typed contract.** `src/constants` mirrors the server's roles, statuses, limits and events, and `src/types/models.ts` mirrors API.md. `src/services/api.ts` unwraps the `{ success, message, data, meta }` envelope in one place (`getData`, `getPage`, `postData` and so on), so features get typed data and never touch axios.
- **Errors are normalized once.** Every failure becomes an `ApiError` with a status, a message fit to show, the field errors from `meta.errors` and the request id. A 5xx never shows the server's text. "No response" and "timed out" get their own plain messages. Cancelled requests pass through untouched, so TanStack Query can tell them apart from failures.
- **Two HTTP clients.** `authHttp` handles `/auth/*`: it sends the cookie but never an access token, and never refreshes. `http` handles everything else: it adds the bearer token and recovers from 401s:
  - **One refresh for any number of 401s.** The refresh is a single shared promise, so every request that fails during it waits for the same answer and is then retried.
  - **Late starters wait.** A request that starts while a refresh runs waits for it, instead of going out with the old token and failing.
  - **No needless refresh.** A 401 for a token that has already been replaced is simply retried with the new one.
  - **One retry per request**, so a request can never loop.
  - **A refused refresh cookie ends the session.**

  The tests drive the real interceptors through a fake adapter.
- **Refreshes are serialized across tabs** with the Web Locks API. Reusing a refresh token makes the server revoke every session of the user (reuse detection). Without a lock, two tabs reloading at once would each send the same cookie, and the second would log the user out everywhere. With it, each tab's refresh sends the cookie the previous one rotated.
- **Logout reaches every tab** through a `BroadcastChannel`. No other tab keeps working with a live access token for up to 15 minutes.
- **The access token exists only in a module variable.** The session is a tiny external store (`services/auth-session.ts`) that React reads through `useSyncExternalStore`. `AuthContext`, the app's only React context, exposes it along with `signIn` and `signOut`.
  - On page load the app restores the session silently: a refresh call that works if the cookie is still good. Because refreshes share one request, React StrictMode's double effect sends only one.
  - When a session ends, the query cache is cleared and the socket closed, so no patient data stays in memory.
- **Toasts live in an external store as well**, not a context. Any mutation callback can call `toast.success(...)`, and only the `<Toaster>` re-renders.
- **Live updates.** One shared Socket.IO connection, opened while at least one screen needs it.
  - Its `auth` option is a function, so every connection attempt carries a current token, refreshed first if it is about to expire.
  - After the server closes the socket at token expiry, the client reconnects on its own.
- **Routing and access.**
  - One route table. Each page is lazy-loaded as its own chunk, through `lazyNamed` (the codebase has named exports only) with `Suspense`.
  - `ProtectedRoute` sends signed-out users to the login page and brings them back to the page they asked for, with its query string.
  - `RoleRoute` shows a 403 page at the same address.
  - The navigation is built from the same role lists (`ROUTE_ACCESS`), so a link and its guard can't disagree.
- **Errors while rendering.**
  - An `ErrorBoundary` around the page outlet keeps the navigation usable when a page crashes, and resets when the route changes.
  - A failed chunk load (a deploy while the tab was open) offers to reload the page.
  - The router's `errorElement` catches anything that gets past both.
- **Accessibility foundations.**
  - A skip link, and on navigation focus moves to `<main>` and the tab title changes.
  - The mobile menu is a native `<dialog>`: the browser traps focus, makes the page inert and closes it on Esc, and focus then returns to the menu button.
  - One global `:focus-visible` ring, and `prefers-reduced-motion` is respected.
  - `FormField` connects label, hint and error through ids, and an input's red border comes from its own `aria-invalid`, so what is seen and what is announced can't differ.
- **The clinic's clock.**
  - A new `VITE_CLINIC_TIMEZONE` (default `Asia/Kolkata`, like the server) decides "today" and past slots, whatever timezone the browser is in.
  - Calendar arithmetic runs on UTC midnight of each `YYYY-MM-DD` date, so no browser offset can shift a day.
  - Dates are formatted with `en-IN` ("Monday, 19 October 2026").
- **TanStack Query defaults.** Only network errors and 5xx responses are retried, never a 4xx. How long data stays fresh depends on how fast it changes:
  - 15 seconds for live data
  - 30 seconds by default
  - 5 minutes for doctors
  - 30 minutes for departments
- **Expected 401 on a first visit.** The silent refresh answers 401 when nobody is signed in on this browser, and Chrome logs every 4xx response in the console. That one request is expected, and the end-to-end checks allow it.

## Frontend Phase 2: Reusable components

- **Native elements first.** `Select`, `RadioGroup`, `Checkbox` and the dialogs are built on `<select>`, radio inputs, checkboxes and `<dialog>`. Keyboard support, screen reader announcements and phone pickers then come from the browser, not from code that could get them wrong. `RadioGroup` takes react-hook-form's `register()` as it is.
- **Variants are typed maps, and `className` is only for layout.** Without a class-merging library, two Tailwind classes for the same property (`px-3` and `px-1`) are decided by stylesheet order, not by the order they are written. So components don't accept overrides that would compete with their own classes: a `variant` or `size` prop chooses between fixed sets instead.
- **Invalid state comes from ARIA.** Fields turn red from their own `aria-invalid`, which `FormField` sets along with the error's id. A button can't carry `aria-invalid` in ARIA 1.2, so the date picker's trigger uses `data-invalid` for the border and `aria-describedby` for the message.
- **DatePicker** follows the WAI-ARIA date picker dialog pattern:
  - The month is a `role="grid"` table with one tab stop. Arrows move by day and week, Home and End to the ends of the week, Page Up and Page Down by month (by year with Shift), Enter picks a day and Esc closes.
  - Unavailable days (before `min`, or blocked by `isDateDisabled`, such as a doctor's days off) stay reachable but can't be picked. Their label says why: "Sunday, 25 October 2026, no sessions".
  - Weeks start on Monday. The popover opens toward the side that has room. Esc inside it is cancelled, so it never closes a surrounding modal at the same time.
  - The date maths (`calendar.ts`) is pure and unit-tested, and so are the keyboard paths.
- **Table: one DOM for both screen sizes.**
  - On phones, CSS turns each row into a card, with the column name before each value (`content: attr(data-label)`). Explicit `table`, `rowgroup`, `row` and `cell` roles keep the table semantics that some browsers drop when a table's display changes. A justified lint exception covers those roles.
  - Sortable headers are buttons, and their `th` carries `aria-sort`.
  - The first load shows skeleton rows. A background refresh keeps the rows and dims them.
- **Memoized table rows.** Rows are wrapped in `React.memo` and keyed by id. TanStack Query's structural sharing keeps unchanged rows as the same objects across refetches, so a refetch or a live update re-renders only the rows that changed. This is measured in Phase 4.
- **Modal and ConfirmDialog** sit on the native `<dialog>`.
  - While an action runs, the dialog can't be dismissed: Esc, the backdrop and the close button do nothing.
  - `ConfirmDialog` names its action ("Cancel appointment"). It has no corner close button, so the safe choice gets the initial focus.
  - Errors appear inside the dialog: a modal makes the rest of the page inert, including toasts.
- **Pagination** shows the first page, the last page and the current page's neighbours, with gaps; a gap never hides a single page. On phones only the current page shows between the arrows. `aria-current="page"` marks the current page, and the "Showing 21–40 of 134" summary is a polite live region.
- **Status always pairs color with text and an icon** (`Badge`), so color is never the only signal.
- **ErrorMessage** says what failed and gives the request id support can trace, with a "Try again" button.
- **Tabs** follow the WAI-ARIA pattern: one tab stop, arrows and Home/End move between tabs, and selection follows focus.
- **Lint.** The strict accessibility preset drops the plugin's allow-list for WAI-ARIA Authoring Practices patterns, such as `<table role="grid">`. The recommended preset's mapping is restored in `eslint.config.ts`.
- **A file-name trap on Windows.** `pagination.ts` next to `Pagination.tsx` can resolve to the wrong file on a case-insensitive file system, so the helper is named `page-items.ts`.

## Frontend Phase 3: Pages

### Data

- **One data layer per feature.** Each feature has an `api.ts` of typed calls and a query-key factory (`appointmentKeys.list(params)`, `slotKeys.day(doctorId, date)`), so a key is never typed by hand and every filter combination is its own cache entry.
  - Queries that depend on a choice not yet made use `skipToken`, which keeps their types sound without `!`.
  - A doctor already loaded in a list shows straight away (`placeholderData`) while their detail loads.
  - Paging, filtering and patient search keep the previous results on screen while the next ones load (`keepPreviousData`), so nothing jumps.
- **One function updates the cache after a change: `syncAppointment()`.** It runs both on a mutation's response and on a Socket.IO event, and running it twice for the same change is harmless.
  - It updates the doctor's slot grid for that day slot by slot. Only the changed slot gets a new object, so only its tile re-renders.
  - It updates the day lists behind the scheduler and the dashboard.
  - It updates the appointment's detail, keeping the full patient record and the notes, which socket events never carry.
  - Paged lists are only invalidated: a change can move a row to another page or out of the filter, so patching them in place could show a wrong page.
- **Live updates, for the scheduler and the booking form.**
  - The screen joins the room `scheduler:{doctorId}:{date}`, and leaves it when the doctor or date changes or the screen closes.
  - Super Admins receive every doctor's events, so each event is checked against the doctor and date on screen.
  - After a reconnect the day is refetched, since changes made while offline were never announced.
  - Each change is read out through an `aria-live` region ("10:15 was just booked for Asha Rao"), and the tile that changed glows once.
  - A slot chosen in the booking form that someone else books meanwhile is flagged before submitting.
- **The clinic's clock in the browser.**
  - A slot the API sent as AVAILABLE shows as PAST the moment its time comes, by the server's own rule (`start <= now`), using one shared minute ticker. An open grid therefore stays right for hours.
  - A refetch every 60 seconds catches anything that live updates miss.

### Screens

- **The day sheet.** The slot grid is laid out by the doctor's sessions ("Morning, 08:00–13:00"), from that weekday's schedule.
  - A break inside a session is drawn between its slots; a lunch between two sessions sits between them. A day never shows a slot inside a break. The layout is a pure, tested function.
  - The three states are told apart by more than color:
    - AVAILABLE is a link to the booking form, for the front desk only.
    - BOOKED is a button that opens the appointment, with the patient's name and status, and an ink bar on its left edge.
    - PAST is hatched and can't be focused.
  - Tiles are memoized.
- **Booking.** The doctor, date and slot live in the URL, through the same hook the scheduler uses, so a slot in the scheduler is a link that fills the form in. The form itself holds the patient and the visit.
  - Both kinds of patient keep their fields in the form, so switching between "Existing patient" and "New patient" loses nothing. Only the chosen kind is validated (zod `superRefine`), and all errors show at once.
  - Patient search waits 300 ms after typing stops and starts at two characters. When nothing matches, "Register a new patient" fills in what was typed: digits go to the mobile number, words to the name.
  - A 409 or 422 (the slot was just taken, or has started) keeps everything typed. The slots are refetched, the chosen time is cleared, and an alert explains what happened.
  - Field errors from a 400 appear on their own fields.
  - After a successful booking, a toast confirms it and the scheduler opens on that day, where the slot is already BOOKED.
- **Appointment list.**
  - The page, sort and filters live in the URL, parsed by zod with `.catch()` defaults, so a hand-edited URL falls back instead of breaking. Default values are left out of the URL, and filter changes replace the history entry.
  - Text filters wait 350 ms after typing stops; selects and dates apply at once.
  - Sorting is done from the column headers (`aria-sort`), or from one "Sort by" choice on narrow screens, where the headers are hidden.
  - A page beyond the end, such as an old link after the list shrank, offers to go back to page 1.
  - Row actions come from `permissionsFor(user, appointment)`, a tested mirror of the API's rules, so only actions that would succeed are offered:
    - check in
    - complete
    - edit purpose and notes (notes only, for doctors)
    - cancel, through the confirm dialog
  - Each action button reads its own pending state through `useMutationState`, so a running action doesn't re-render the table.
  - The edit form sends only the fields that changed, and never `purpose` for a doctor. A refused change (409) shows the server's message and refetches.
- **One dialog at a time.** Details, edit and cancel are states of one controller. "Edit details" in the details dialog swaps dialogs instead of stacking them.
- **Dashboard.** It uses `GET /appointments` for today, all pages of 100; no new endpoint was needed. A pure, tested `summarizeDay` gives:
  - counts by status
  - who is waiting, who is next and who is running late
  - each doctor's load

  It follows the dataviz guidance:
  - Headline numbers are stat tiles, not charts, with proportional figures at that size.
  - Part-to-whole is one thin stacked bar in workflow order (completed, waiting, still to come), with 2px gaps and a legend. The bar is hidden from screen readers because the numbers are in text, and each segment has a hover title.
  - The bar's colors are chart-only steps of the status hues. They were run through the dataviz palette validator; the original text colors failed its lightness band. The adjacent pairs now pass the colour-blindness check (worst Delta E 8.7, protanopia).
  - Super Admins also get a per-doctor table that lists every doctor, even one with nothing booked. Its bars are scaled to the busiest doctor, so they compare across rows, and it doubles as the chart's text equivalent.

  The dashboard refreshes every 60 seconds. At a much larger scale, a summary endpoint would be cheaper than fetching the whole day.
- **Staff and schedules.** The tab and the chosen doctor are in the URL.
  - The schedule editor shows all seven days, each switched on or off, with field arrays for sessions and breaks. "Use a standard week" fills in Monday to Friday, 09:00–12:00 and 13:00–17:00 with lunch in between.
  - `findScheduleProblems` mirrors the server's schedule rules and is unit-tested. Each problem (overlapping sessions, a break outside working hours) shows on the exact range it is about.
  - An API error on `body.schedule.N` is mapped from the N-th working day back to the editor's row.
  - Creating a doctor uses three separately typed forms (account, profile, schedule), validated together, with focus on the first problem in reading order. A typed form per part means no casts; the alternative was RHF's form context.
  - A taken email (409) shows on the email field. Saving a schedule refetches every cached slot grid, since the slots themselves change.
- **Container queries where a component lives in more than one width.**
  - The table switches between cards and rows at a container width of 48rem, not at a screen width, because the same table sits beside the sidebar on a desktop and alone on a tablet.
  - The doctor, department and date fields stack in the booking form's narrow column, and line up in the scheduler's wide panel.
- **The one inline style:** the data-driven width of a chart bar, which no static class can express.

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

Client libraries:

| Library | Why |
| --- | --- |
| React 19 | The required UI library |
| Vite 8 | A fast dev server with hot reload, and an optimized production build |
| React Router 7 | The required router: nested layouts, lazy-loaded routes, and URL query params for list filters |
| TanStack Query 5 | The server-state cache: merges duplicate requests, tracks staleness, refetches, gives loading and error states, and lets socket events update the cache |
| axios | Interceptors for the bearer token and the refresh on 401, and `withCredentials` for the refresh cookie |
| react-hook-form, @hookform/resolvers | Fast, uncontrolled forms validated by zod schemas |
| zod 4 | The server's validation library, so form rules and types come from the same kind of schema |
| socket.io-client 4 | Matches the server's Socket.IO, for live scheduler updates |
| Tailwind CSS 4 | Utility styling on shared design tokens, with no runtime |
| lucide-react | Consistent, tree-shaken SVG icons, `aria-hidden` by default |
| Fontsource (Atkinson Hyperlegible Next) | The typeface, self-hosted: no request to a third-party font CDN |
| ESLint plugins: react-hooks, react-refresh, jsx-a11y-x, @tanstack/eslint-plugin-query | Hook rules, hot-reload-safe exports, accessibility and query-key checks |
| Vitest, jsdom, Testing Library | Unit and component tests that run on the app's own Vite config |
| Prettier, prettier-plugin-tailwindcss | Consistent formatting and class order |

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

- One phase per commit on `feat/backend`, using conventional commits. The frontend follows the same rules on `feat/frontend`, which was branched from `feat/backend`.
- Messages follow the 50/72 format and carry only the author's name, with no AI co-author lines. The git email is set for this repository only.
- Every commit passes the same gates: Prettier, type-check, lint, the whole test suite and a production build.
- `.env` is never committed.
