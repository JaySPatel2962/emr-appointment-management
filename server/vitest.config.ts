import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    restoreMocks: true,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Only satisfies env validation: integration tests connect to the in-memory replica set
      // (tests/helpers/setup-db.ts), never to this address or to Atlas.
      MONGO_URI: 'mongodb://127.0.0.1:27017/unused-in-tests',
      CLIENT_URL: 'http://localhost:5173',
      RATE_LIMIT_MAX: '10000',
      LOGIN_RATE_LIMIT_MAX: '10000',
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/helpers/global-setup.ts'],
          setupFiles: ['tests/helpers/setup-db.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
