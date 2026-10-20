# Engineering decisions

Why I built the EMR appointment module this way. Detail is in [`docs/decisions-notes.md`](docs/decisions-notes.md), and the database in [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md).

## 1. Why this architecture?

One domain, one team and one database, so I built a modular monolith in two packages, `server/` and `client/`, deployed separately. The server runs route → zod validator → thin controller → service → model. Business rules live only in services, which return plain typed objects and never see `req` or `res`, so tests, scripts and sockets share them. One response envelope, one error mapper. Sockets sit behind an emitter interface, so the appointment service doesn't know they exist. The client is organized by feature. Server state lives in TanStack Query, the session in the one React context, and all HTTP goes through one module that handles tokens. TypeScript is strict throughout.

## 2. How is the MongoDB schema designed?

The collections are users, doctors, departments, patients, appointments, refresh_tokens, audit_logs and counters.

- **Embedded:** a doctor's weekly schedule (at most 7 days, always read with the doctor, replaced whole).
- **Referenced:** an appointment's patient, doctor, department and creator.
- **Denormalized:** appointments copy the patient's code, name (plus a lowercase copy and its words) and mobile, and the doctor's name. The busy appointment list can then filter, search and sort from indexes with no `$lookup`. The cost: a rename wouldn't reach old appointments, and no flow edits names yet.
- **Dates and times** are clinic-timezone strings (`"YYYY-MM-DD"`, `"HH:mm"`). They never shift with the server's zone, and they make an exact key for the double-booking index.
- **Slots are computed**, never stored, so nothing goes stale when a schedule changes.

## 3. How is double booking prevented?

- **A partial unique index** on `{ doctorId, date, slotStart }`, for SCHEDULED, ARRIVED and COMPLETED only, so a cancelled slot frees up.
- **Insert first.** The booking is a plain insert. The database rejects a second one with error 11000, which becomes `409 Slot already booked`. Check-then-insert is unsafe: two requests can both read "free" before either writes, and an app-level lock covers only one instance. In tests, 10 parallel bookings give one 201 and nine 409s; manual QA repeated it with 40 parallel calls.
- **New patients** are saved in the same transaction as their appointment, so a lost race leaves no orphan record. A transient write conflict reruns the transaction once, then answers 409 "try again", never a 500.
- **The index can't see time overlaps.** It compares start times, so 10:00–10:30 and 10:20–10:40 don't collide. Manual QA produced that after a slot-length change. So bookings must sit on the current grid:
  - Only slots the generator offers can be booked.
  - A schedule change that would strand a booking gets 409, listing it.
  - A change and a booking that race each write, then re-check, and the loser undoes itself.
  - Schedule saves carry a `scheduleVersion`, so two admins can't overwrite each other.

  The overlap and duplicate queries now return 0.

## 4. Which indexes, and why?

| Collection         | Index                                                                                                                   | Query served                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| appointments       | `{ doctorId, date, slotStart }` unique, partial                                                                         | The double-booking guard                            |
| appointments       | `{ doctorId, date }`                                                                                                    | A doctor's day: slot grid, own list, schedule check |
| appointments       | `{ status, date }`, `{ departmentId, date }`                                                                            | Filters with a date range                           |
| appointments       | `{ date, slotStart, _id }`, `{ createdAt, _id }`, `{ patientNameLower, _id }`, `{ doctorName, _id }`, `{ status, _id }` | Each list sort, read in order                       |
| appointments       | `{ patientNameWords }` multikey, `{ patientMobile }`                                                                    | Name and mobile filters (anchored prefixes)         |
| patients           | `{ patientCode }` unique, `{ mobile }`, `{ nameWords }` multikey, `{ nameLower, _id }`                                  | Search by ID, mobile or any name word; list by name |
| doctors            | `{ userId }` unique, `{ departmentId, name }`, `{ name }`, `{ specialization }`                                         | Login, by department, list, search                  |
| users, departments | `{ email }` unique; `{ name }` unique, case-insensitive                                                                 | Login; no duplicates                                |
| refresh_tokens     | `{ tokenHash }` unique, `{ userId }`, `{ expiresAt }` TTL                                                               | Refresh, revoke all, cleanup                        |
| audit_logs         | `{ createdAt: -1 }`, `{ entity, entityId, createdAt: -1 }`                                                              | Recent activity; a record's history                 |

Each index serves a real query, since each slows writes. `explain` on all 37 list and search shapes shows no COLLSCAN, and an unfiltered page reads 20 keys for 20 rows (before the sort indexes, the same page meant a full scan and an in-memory sort of 43,260 documents). Searches still sort their few dozen matches in memory, because a prefix range can't also give another field's order (kept: Q-09).

## 5. Which security measures?

- **Auth.** The access JWT (15 minutes) is kept in memory only; lint bans web storage. The refresh JWT (7 days) exists only in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie on `/api/v1/auth`. The two use separate secrets and audiences, with the algorithm pinned. Passwords use bcrypt at cost 12. Every failed login gets the same 401, including the timing for an unknown email.
- **Refresh rotation.** Each refresh atomically revokes the old token. Reusing a revoked one revokes all that user's sessions, and is audited.
- **RBAC.** Every route runs authenticate → authorize → validate. Doctor scoping is enforced in the services, and another doctor's records answer 404. A role-by-endpoint test matrix covers it.
- **Validation.** zod checks every body, query and params, and the query parser is flat. `$`, `.` and prototype keys are stripped, bodies nested beyond 32 levels get 400, and bodies are capped at 100 kb.
- **CORS and origin check.** CORS allows one origin. The cookie endpoints also refuse a foreign `Origin` with 403, after manual QA found any site could sign staff out. curl and Postman, which send no Origin, still work.
- **Limits and headers.** 300 requests and 10 failed logins per 15 minutes per IP; helmet sets the headers.
- **Nothing secret leaks.** Responses never contain hashes, and tokens appear only where issued. A 5xx hides its message. Logs redact credentials and leave out query strings and the database URI. `.env` has never been committed.

## 6. Which performance optimizations?

**Server.**

- An index for every list, search and sort, and `estimatedDocumentCount()` for unfiltered totals.
- `.lean()` with projections, with each page and its count fetched in parallel.
- No N+1 queries: a slot grid costs two queries.
- Word arrays, so prefix search can use an index.

**Client.**

- Lazy page chunks of 2–6 KB, and cached vendor chunks.
- TanStack Query freshness tuned per data type.
- Socket events and mutations patch the cache instead of refetching.
- `React.memo` only where render counts proved it (1 tile of 19 re-renders on a live booking).
- Debounced search, one clock ticker, and one socket in one room.

## 7. What would change for millions of appointments?

- **Shard** appointments on `{ doctorId: 1, date: 1 }`. The unique index keeps that prefix, and a doctor's day stays on one shard. Hashing `doctorId` would spread writes but scatter date ranges. Clinic-wide lists would move to a read model.
- **Archive** past appointments by date (an archive collection or Atlas Online Archive).
- **Read replicas** for lists and reports; bookings stay on the primary.
- **Audit logs** written through an outbox and a queue worker, with a TTL or cold storage after the legal retention period.
- **Cache** slot grids for seconds in Redis, invalidated by events; the unique index stays the authority.
- **Socket.IO** across instances with the Redis adapter and sticky sessions.
- **Atlas Search** for names, and a summary endpoint for the dashboard.

## Real-time approach

- **Connection.** Socket.IO shares the API server, and the handshake carries the access token. An expired token drops the socket, and the client reconnects with a fresh one.
- **Rooms.** Rooms are `scheduler:{doctorId}:{date}`: a screen joins only the day it shows, a doctor only their own, and Super Admins get everything through an `admin` room.
- **Events.** `created`, `updated` and `cancelled` go out only after a successful write, never carry notes, and a failed broadcast never fails a request.
- **Reconnect.** After a reconnect, the client refetches the day. Events patch the cache, and `aria-live` announces them.

## Trade-offs and known gaps

**Manual QA questions** ([report](docs/MANUAL_TEST_REPORT.md)):

- **Resolved:** Q-02 (an "Is it one of these?" hint for shared mobiles), Q-03 (any-word name search), Q-06 (sort indexes), Q-07 (no stranded bookings) and Q-08 (stale saves refused).
- **Kept:** Q-01 (a doctor may have no working days), Q-04 (no booking horizon), Q-05 (unknown query parameters get 200, not 400) and Q-09 (searches sort in memory).

**Other gaps:** audit writes are best effort; a deactivated user keeps access for up to 15 minutes; the server runs as one instance; copied names aren't re-synced; Node 20 is end-of-life.

**The 12 bugs manual QA found**, each fixed in its own commit with a regression test:

- **Security:** cross-site logout; a 500 on deeply nested JSON; audit entries without a role.
- **Search:** separator-only searches matched everyone; stale search results stayed on screen.
- **Offline:** silent pauses, and a misleading "new version" message.
- **Layout:** long names breaking layouts; a tab scrollbar; a refusal shown out of view; clipped times on phones; no sort control at 768 px.
