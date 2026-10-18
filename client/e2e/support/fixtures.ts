import { test as base, expect } from '@playwright/test';
import type { BrowserContext, BrowserContextOptions, Page } from '@playwright/test';

import { signInToApi } from './api';
import type { ApiClient } from './api';
import { stackInfo } from './env';
import type { Account } from './seed-data';

interface ExpectedResponse {
  status: number;
  url: RegExp;
}

/**
 * Watches every page of a test for console errors and warnings, uncaught exceptions, failed
 * requests and error responses, and fails the test if it saw any it wasn't told to expect.
 */
export interface PageGuard {
  /** An error response the test provokes on purpose, such as the 409 for a taken slot. */
  expectResponse: (status: number, url: RegExp) => void;
  /** Watches the pages of a context the test opened itself. */
  watch: (context: BrowserContext) => void;
}

const ALWAYS_EXPECTED: readonly ExpectedResponse[] = [
  // Opening the app without a session asks the API for one; 401 is its "no".
  { status: 401, url: /\/api\/v1\/auth\/refresh$/ },
];

// Chromium logs every 4xx and 5xx response to the console; the response check judges those.
const NETWORK_CONSOLE_MESSAGE = 'Failed to load resource: the server responded with a status of';

// What the page abandons itself: requests cut off by navigation, or fetches TanStack Query
// cancels because their answer is no longer wanted.
const ABORTED = 'net::ERR_ABORTED';

const createGuard = () => {
  const problems: string[] = [];
  const expected: ExpectedResponse[] = [...ALWAYS_EXPECTED];

  const watchPage = (page: Page): void => {
    page.on('console', (message) => {
      const type = message.type();
      if (
        (type === 'error' || type === 'warning') &&
        !message.text().startsWith(NETWORK_CONSOLE_MESSAGE)
      ) {
        problems.push(`console.${type}: ${message.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      problems.push(`uncaught ${error.name}: ${error.message}`);
    });
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? 'unknown';
      if (reason !== ABORTED) {
        problems.push(`request failed (${reason}): ${request.method()} ${request.url()}`);
      }
    });
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();
      if (status >= 400 && !expected.some((item) => item.status === status && item.url.test(url))) {
        problems.push(`HTTP ${status}: ${response.request().method()} ${url}`);
      }
    });
  };

  const guard: PageGuard = {
    expectResponse: (status, url) => {
      expected.push({ status, url });
    },
    watch: (context) => {
      context.pages().forEach(watchPage);
      context.on('page', watchPage);
    },
  };
  return { guard, problems };
};

/** An API session as `account`: someone else acting while the page under test is open. */
export const apiAs = (account: Account): Promise<ApiClient> =>
  signInToApi(stackInfo().apiUrl, account);

/** Logs in through the API: the browser context then holds the refresh cookie, as after a login. */
export const signIn = async (context: BrowserContext, account: Account): Promise<void> => {
  const response = await context.request.post(`${stackInfo().apiUrl}/auth/login`, {
    data: { email: account.email, password: account.password },
  });
  expect(response.status(), `logging in as ${account.email}`).toBe(200);
};

interface Fixtures {
  guard: PageGuard;
  /** Another browser window with its own cookies, signed in as `account`: a second user. */
  openWindow: (account: Account, options?: BrowserContextOptions) => Promise<Page>;
}

export const test = base.extend<Fixtures>({
  guard: [
    async ({ context }, use) => {
      const { guard, problems } = createGuard();
      guard.watch(context);
      await use(guard);
      expect(problems, 'console errors, uncaught errors and failed requests').toEqual([]);
    },
    { auto: true },
  ],

  openWindow: async ({ browser, guard, baseURL, locale, timezoneId, viewport }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (account, options = {}) => {
      const context = await browser.newContext({
        ...(baseURL === undefined ? {} : { baseURL }),
        ...(locale === undefined ? {} : { locale }),
        ...(timezoneId === undefined ? {} : { timezoneId }),
        viewport,
        ...options,
      });
      contexts.push(context);
      guard.watch(context);
      await signIn(context, account);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect };
