import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      restoreMocks: true,
      unstubEnvs: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        // The entry point only mounts the app; test helpers and type declarations aren't app code.
        exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
        reporter: ['text-summary', 'html'],
      },
    },
  }),
);
