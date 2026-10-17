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
