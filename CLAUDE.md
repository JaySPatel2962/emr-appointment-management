# CLAUDE.md

## Project
Enterprise EMR appointment management module (MERN). Code quality and architecture matter more than feature count.

## Stack
- Server: Node (>= 20.19), Express 5, MongoDB, Mongoose, Socket.IO, zod, JWT, bcrypt
- Client: React (Vite), React Router, axios
- TypeScript only, strict mode, no `any`, no `@ts-ignore`

## Structure
- `server/src/`: config, constants, controllers, middlewares, models, routes, services, sockets, scripts, types, validators, utils
- `server/tests/`: `unit/`, `integration/`, `helpers/`
- `client/src/`: components, pages, routes, services, context, hooks, utils

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
- Frontend: reusable components, loading and error states, `React.memo`/`useCallback` only where useful

## Workflow
- Plan before coding; one feature per commit, using conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- Commit messages: a subject of at most 50 characters, imperative, lowercase after the type prefix, no trailing period (e.g. `feat: add slot generation`); then a blank line and a body wrapped at 72 characters that explains what changed and why
- Commits and PRs carry only the author's name: no `Co-Authored-By` trailers or AI attribution lines
- Never commit `.env`; keep `.env.example` updated
- Update `README.md` and `ENGINEERING_DECISIONS.md` as features land; record design decisions in `docs/decisions-notes.md`

## Commands
Server (run in `server/`):
- Setup: `npm install`, copy `.env.example` to `.env` and fill in the values, then `npm run seed`
- `npm run dev`: start the API with auto-reload (tsx)
- `npm run build`, then `npm start`: compile to `dist/` with tsc and run the build
- `npm run lint` / `npm run format`: ESLint / Prettier
- `npm run typecheck`: `tsc --noEmit`
- `npm test`: Vitest unit and integration tests (integration tests use an in-memory MongoDB replica set, never Atlas)
- `npm run seed`: create the first Super Admin and the departments from env vars

Client (run in `client/`): `npm run dev`

## NOTE
- Never use niro for anything
