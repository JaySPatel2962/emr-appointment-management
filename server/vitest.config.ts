import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The process entry point and one-off scripts are exercised by running them, not by tests.
      exclude: ['src/server.ts', 'src/scripts/**', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'html'],
    },
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Only satisfies env validation: integration tests connect to the in-memory replica set
      // (tests/helpers/setup-db.ts), never to this address or to Atlas.
      MONGO_URI: 'mongodb://127.0.0.1:27017/unused-in-tests',
      CLIENT_URL: 'http://localhost:5173',
      JWT_ACCESS_SECRET: 'test-access-secret-not-used-anywhere-else-0001',
      JWT_REFRESH_SECRET: 'test-refresh-secret-not-used-anywhere-else-0002',
      // The lowest cost bcrypt accepts keeps password hashing fast in tests.
      BCRYPT_ROUNDS: '4',
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
