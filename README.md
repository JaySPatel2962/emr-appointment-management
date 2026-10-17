# EMR Appointment Management

Appointment management module for an enterprise EMR system. It covers role-based access (Super Admin, Receptionist, Doctor), doctor schedules, dynamically generated slots, booking that is safe against double booking, and real-time scheduler updates.

> **Status:** the backend (`server/`) is being built phase by phase. Design decisions are recorded in [`docs/decisions-notes.md`](docs/decisions-notes.md). The frontend hasn't been started.

## Tech stack

- **Server:** Node.js (>= 20.19), Express 5, MongoDB with Mongoose, zod, JWT, bcrypt, Socket.IO, TypeScript (strict)
- **Tooling:** tsx (development), tsc (build), ESLint and Prettier, Vitest with supertest and mongodb-memory-server

## Getting started (server)

```bash
cd server
npm install
cp .env.example .env   # then fill in real values
npm run dev
```

## Scripts (server)

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the API with auto-reload (tsx) |
| `npm run build` | Compiles TypeScript to `dist/` (tsc) |
| `npm start` | Runs the compiled build |
| `npm run seed` | Creates the first Super Admin and the departments from env vars |
| `npm run lint` | ESLint (type-aware) |
| `npm run format` | Prettier |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit and integration tests (in-memory MongoDB replica set, never Atlas) |

## Environment variables (server)

Copy `server/.env.example` to `server/.env`. Never commit `.env`.

| Variable | Description | Default |
| --- | --- | --- |
| `NODE_ENV` | `development`, `test` or `production` | `development` |
| `PORT` | HTTP port | `5000` |
| `MONGO_URI` | MongoDB (Atlas) connection string | required |
| `CLIENT_URL` | Frontend origin allowed by CORS | `http://localhost:5173` |
| `CLINIC_TIMEZONE` | IANA timezone for all appointment dates and times | `Asia/Kolkata` |

## Project structure

```text
server/
  src/      application code: config, constants, controllers, middlewares, models,
            routes, services, sockets, scripts, types, validators, utils
  tests/    unit/, integration/, helpers/
docs/       assessment brief and design decision notes
```

Server modules import each other through the `#app/*` alias (for example `#app/config/env.js`), which Node resolves natively through `package.json` `imports`.
