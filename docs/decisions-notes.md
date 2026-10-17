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

- **Fail-fast configuration.** `config/env.ts` validates every environment variable with zod at startup. If any is invalid, the server stops and lists the variable names, never their values. Only `MONGO_URI` is required; everything else has a safe default. Tests never load `.env` (they take their values from `vitest.config.ts`), so a developer's Atlas credentials can't leak into a test run. The JWT variables arrive with auth in Phase 3, so the app can start before auth exists. That is a small deviation from the original plan.
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
- **Indexes.** `autoIndex` is on, so the partial unique index is created at startup. After connecting, the server waits for every model's index build and logs any failure with the model's name.

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
