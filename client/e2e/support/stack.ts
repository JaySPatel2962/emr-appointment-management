import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import type { WriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { connect } from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { CLINIC_TIMEZONE, E2E_API_PORT, E2E_API_URL, E2E_CLIENT_URL, E2E_DATABASE } from './config';
import { ADMIN, DEPARTMENT_NAMES } from './seed-data';

// The backend the tests run against: the real API (from ../server, in TypeScript through tsx) on
// an in-memory MongoDB replica set, which bookings need for their transactions. NODE_ENV=test
// makes the server skip server/.env, so the developer's database is never touched.

const CLIENT_DIR = path.resolve(import.meta.dirname, '../..');
const SERVER_DIR = path.resolve(CLIENT_DIR, '../server');
export const API_LOG_FILE = path.join(CLIENT_DIR, 'test-results', 'api.log');

const STARTUP_TIMEOUT_MS = 60_000;

// Only what Node and the OS need: a variable exported in the developer's shell can't change how
// the test API behaves.
const SYSTEM_VARIABLES = [
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'windir',
  'ComSpec',
  'TEMP',
  'TMP',
  'TMPDIR',
  'HOME',
  'USERPROFILE',
  'APPDATA',
  'LOCALAPPDATA',
] as const;

const systemEnv = (): Record<string, string> =>
  Object.fromEntries(
    SYSTEM_VARIABLES.flatMap((name) => {
      const value = process.env[name];
      return value === undefined ? [] : [[name, value]];
    }),
  );

const newSecret = (): string => randomBytes(48).toString('base64url');

const isListening = (port: number, host: string): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });

const assertPortFree = async (port: number): Promise<void> => {
  const taken = await Promise.all([isListening(port, '127.0.0.1'), isListening(port, '::1')]);
  if (taken.some(Boolean)) {
    throw new Error(
      `Port ${port} is already in use. Stop whatever runs there, then start the tests again.`,
    );
  }
};

const runServerScript = (script: string, env: Record<string, string>, log: WriteStream) => {
  const child = spawn(process.execPath, ['--import', 'tsx', '--conditions=development', script], {
    cwd: SERVER_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  return child;
};

const exitOf = (child: ChildProcess): Promise<number | null> =>
  child.exitCode !== null
    ? Promise.resolve(child.exitCode)
    : new Promise((resolve) => child.once('exit', resolve));

const stopProcess = async (child: ChildProcess): Promise<void> => {
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {
    return;
  }
  const exited = exitOf(child);
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
  await Promise.race([exited, delay(5000)]);
};

const waitForHealth = async (api: ChildProcess): Promise<void> => {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) {
      throw new Error(
        `The API stopped during startup (exit code ${api.exitCode}). See ${API_LOG_FILE}`,
      );
    }
    try {
      const response = await fetch(`${E2E_API_URL}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }
    await delay(250);
  }
  throw new Error(`The API did not become healthy within a minute. See ${API_LOG_FILE}`);
};

export interface Stack {
  accessTokenSecret: string;
  stop: () => Promise<void>;
}

/** Starts MongoDB and the API, with the Super Admin and departments from the seed script. */
export const startStack = async (): Promise<Stack> => {
  await assertPortFree(E2E_API_PORT);
  await mkdir(path.dirname(API_LOG_FILE), { recursive: true });
  const log = createWriteStream(API_LOG_FILE, { flags: 'w' });

  const database = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const accessTokenSecret = newSecret();
  const env: Record<string, string> = {
    ...systemEnv(),
    NODE_ENV: 'test',
    PORT: String(E2E_API_PORT),
    LOG_LEVEL: 'warn',
    MONGO_URI: database.getUri(E2E_DATABASE),
    CLIENT_URL: E2E_CLIENT_URL,
    CLINIC_TIMEZONE,
    JWT_ACCESS_SECRET: accessTokenSecret,
    JWT_REFRESH_SECRET: newSecret(),
    // Fast hashing, and no rate limit: the suite logs in many times from one address.
    BCRYPT_ROUNDS: '4',
    RATE_LIMIT_MAX: '1000000',
    LOGIN_RATE_LIMIT_MAX: '1000000',
    SEED_ADMIN_NAME: ADMIN.name,
    SEED_ADMIN_EMAIL: ADMIN.email,
    SEED_ADMIN_PASSWORD: ADMIN.password,
    SEED_DEPARTMENTS: DEPARTMENT_NAMES.join(','),
  };

  let api: ChildProcess | null = null;
  const stop = async (): Promise<void> => {
    if (api !== null) {
      await stopProcess(api);
    }
    await database.stop();
    log.end();
  };

  try {
    const seedExit = await exitOf(runServerScript('src/scripts/seed.ts', env, log));
    if (seedExit !== 0) {
      throw new Error(
        `The seed script failed (exit code ${String(seedExit)}). See ${API_LOG_FILE}`,
      );
    }
    api = runServerScript('src/server.ts', env, log);
    await waitForHealth(api);
  } catch (error) {
    await stop();
    throw error;
  }

  return { accessTokenSecret, stop };
};
