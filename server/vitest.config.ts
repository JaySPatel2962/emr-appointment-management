import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    restoreMocks: true,
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
