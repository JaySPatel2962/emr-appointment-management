// Where the end-to-end stack runs. The ports differ from the dev defaults (API 5000, app 5173),
// so a dev server that happens to be running is never tested by mistake: global setup and
// Playwright's web server both refuse to start when their port is taken.

export const CLINIC_TIMEZONE = 'Asia/Kolkata';

/** A database of its own, in an in-memory MongoDB that disappears after the run. */
export const E2E_DATABASE = 'emr_appointments_e2e';

export const E2E_API_PORT = 5100;
export const E2E_CLIENT_PORT = 4173;

export const E2E_API_URL = `http://localhost:${E2E_API_PORT}/api/v1`;
export const E2E_SOCKET_URL = `http://localhost:${E2E_API_PORT}`;
export const E2E_CLIENT_URL = `http://localhost:${E2E_CLIENT_PORT}`;
