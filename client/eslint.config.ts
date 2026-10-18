import eslint from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import prettierConfig from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const NO_BROWSER_STORAGE =
  'Nothing is persisted in browser storage; the access token lives in memory only.';

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'node_modules/', 'playwright-report/', 'test-results/'] },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Tool config files live outside src and are type-checked with tsconfig.node.json.
          allowDefaultProject: ['*.config.ts'],
          defaultProject: 'tsconfig.node.json',
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'ExportDefaultDeclaration', message: 'Use named exports.' },
      ],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.configs.strict,
      pluginQuery.configs['flat/recommended'],
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      'react-hooks/exhaustive-deps': 'error',
      // Event handlers may be async (react-hook-form's handleSubmit returns a promise).
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: NO_BROWSER_STORAGE },
        { name: 'sessionStorage', message: NO_BROWSER_STORAGE },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: NO_BROWSER_STORAGE },
        { object: 'window', property: 'sessionStorage', message: NO_BROWSER_STORAGE },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message: 'Call the API through @/services/http, which adds the token and refresh.',
            },
          ],
        },
      ],
    },
  },
  {
    // The HTTP layer is the one place that talks to axios directly.
    files: ['src/services/**/*.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Tool config files run in Node and must default-export their config.
    files: ['*.config.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettierConfig,
);
