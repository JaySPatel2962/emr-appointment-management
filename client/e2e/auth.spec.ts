import type { Page } from '@playwright/test';

import { listSummary, logInWithForm, navLink, openAs, pageHeading } from './support/app';
import { stackInfo } from './support/env';
import { apiAs, expect, signIn, test } from './support/fixtures';
import { ADMIN, KAVYA, RECEPTIONIST } from './support/seed-data';
import type { Account } from './support/seed-data';
import { expiredAccessToken } from './support/tokens';

const REFRESH_COOKIE = 'emr_refresh';

const ROLES: readonly { role: string; account: Account; dashboard: string }[] = [
  { role: 'Super Admin', account: ADMIN, dashboard: 'Today at the clinic' },
  { role: 'Receptionist', account: RECEPTIONIST, dashboard: 'Today at the clinic' },
  { role: 'Doctor', account: KAVYA, dashboard: 'Your day' },
];

/** Every API call the page makes, as "METHOD /path status", in order. */
const recordApiCalls = (page: Page): string[] => {
  const calls: string[] = [];
  page.on('response', (response) => {
    const { pathname } = new URL(response.url());
    if (pathname.startsWith('/api/v1/')) {
      calls.push(`${response.request().method()} ${pathname} ${response.status()}`);
    }
  });
  return calls;
};

test.describe('Logging in', () => {
  for (const { role, account, dashboard } of ROLES) {
    test(`a ${role} logs in with the form and lands on their dashboard`, async ({ page }) => {
      await page.goto('/login');
      await expect(pageHeading(page, 'Log in')).toBeVisible();
      await logInWithForm(page, account);

      await expect(page).toHaveURL('/');
      await expect(pageHeading(page, dashboard)).toBeVisible();
      const sidebar = page.getByRole('complementary');
      await expect(sidebar.getByText(account.name, { exact: true })).toBeVisible();
      await expect(sidebar.getByText(role, { exact: true })).toBeVisible();
    });
  }

  test('a wrong password is refused, and the password is cleared for another try', async ({
    page,
    guard,
  }) => {
    guard.expectResponse(401, /\/api\/v1\/auth\/login$/);
    await page.goto('/login');
    await logInWithForm(page, { ...RECEPTIONIST, password: 'NotThePassword1' });

    await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
    await expect(page).toHaveURL('/login');
    const password = page.getByLabel('Password', { exact: true });
    await expect(password).toHaveValue('');
    await expect(password).toBeFocused();
  });

  test('the form says what is missing before sending anything', async ({ page }) => {
    let attempts = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/auth/login')) {
        attempts += 1;
      }
    });
    await page.goto('/login');
    const submit = page.getByRole('button', { name: 'Log in' });

    await submit.click();
    await expect(page.getByText('Enter your email address')).toBeVisible();
    await expect(page.getByText('Enter your password')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeFocused();

    await page.getByLabel('Email').fill('priya.nair');
    await submit.click();
    await expect(
      page.getByText('Enter a valid email address, like name@clinic.example'),
    ).toBeVisible();
    expect(attempts).toBe(0);
  });

  test('a signed-out visit goes to the login page, then on to the page asked for', async ({
    page,
  }) => {
    await page.goto('/appointments?status=SCHEDULED');
    await expect(page).toHaveURL('/login');

    await logInWithForm(page, RECEPTIONIST);
    await expect(page).toHaveURL('/appointments?status=SCHEDULED');
    await expect(pageHeading(page, 'Appointments')).toBeVisible();
    await expect(page.getByLabel('Status')).toHaveValue('SCHEDULED');
  });

  test('the login page sends someone already signed in to the dashboard', async ({ page }) => {
    await openAs(page, RECEPTIONIST, '/login');
    await expect(page).toHaveURL('/');
    await expect(pageHeading(page, 'Today at the clinic')).toBeVisible();
  });
});

test.describe('Staying signed in', () => {
  test('a reload keeps the session', async ({ page }) => {
    await page.goto('/login');
    await logInWithForm(page, RECEPTIONIST);
    await expect(pageHeading(page, 'Today at the clinic')).toBeVisible();
    await navLink(page, 'Scheduler').click();
    await expect(pageHeading(page, 'Scheduler')).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL('/scheduler');
    await expect(pageHeading(page, 'Scheduler')).toBeVisible();
  });

  test('tokens never reach web storage or a cookie scripts can read', async ({ page, context }) => {
    await page.goto('/login');
    await logInWithForm(page, RECEPTIONIST);
    await expect(pageHeading(page, 'Today at the clinic')).toBeVisible();

    const storage = await page.evaluate(() => ({
      local: Object.keys(window.localStorage),
      session: Object.keys(window.sessionStorage),
      cookies: document.cookie,
    }));
    expect(storage).toEqual({ local: [], session: [], cookies: '' });

    const refresh = (await context.cookies()).find((cookie) => cookie.name === REFRESH_COOKIE);
    expect(refresh).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/api/v1/auth',
    });
  });

  test('an expired access token is renewed without the user noticing', async ({ page, guard }) => {
    const { accessTokenSecret } = stackInfo();
    const { user } = await apiAs(RECEPTIONIST);
    const expired = expiredAccessToken(user, accessTokenSecret);
    guard.expectResponse(401, /\/api\/v1\/appointments\?/);
    const calls = recordApiCalls(page);

    // The first list request goes out with a token whose 15 minutes have run out.
    let swapped = false;
    await page.route(
      (url) => url.pathname === '/api/v1/appointments',
      async (route) => {
        if (swapped) {
          await route.continue();
          return;
        }
        swapped = true;
        await route.continue({
          headers: { ...route.request().headers(), authorization: `Bearer ${expired}` },
        });
      },
    );

    await openAs(page, RECEPTIONIST, '/appointments');
    // The summary appears with the data, not with the loading placeholders.
    await expect(listSummary(page)).toBeVisible();
    await expect(page).toHaveURL('/appointments');

    // The API refused it, the page renewed its token once, and the retry succeeded.
    const refused = calls.indexOf('GET /api/v1/appointments 401');
    const renewed = calls.indexOf('POST /api/v1/auth/refresh 200', refused);
    const retried = calls.indexOf('GET /api/v1/appointments 200', refused);
    expect(refused, calls.join('\n')).toBeGreaterThanOrEqual(0);
    expect(renewed, calls.join('\n')).toBeGreaterThan(refused);
    expect(retried, calls.join('\n')).toBeGreaterThan(renewed);
  });

  test('when the session can no longer be renewed, the user is asked to log in again', async ({
    page,
    context,
    guard,
  }) => {
    const { accessTokenSecret } = stackInfo();
    const { user } = await apiAs(RECEPTIONIST);
    const expired = expiredAccessToken(user, accessTokenSecret);
    guard.expectResponse(401, /\/api\/v1\/appointments\?/);
    await openAs(page, RECEPTIONIST, '/');

    // A week has passed: the access token and the refresh cookie have both expired.
    await context.clearCookies();
    const listRequest = (url: URL) => url.pathname === '/api/v1/appointments';
    await page.route(listRequest, (route) =>
      route.continue({
        headers: { ...route.request().headers(), authorization: `Bearer ${expired}` },
      }),
    );
    await navLink(page, 'Appointments').click();

    await expect(page).toHaveURL('/login');
    await expect(pageHeading(page, 'Log in')).toBeVisible();
    await page.unroute(listRequest);
    await logInWithForm(page, RECEPTIONIST);
    await expect(page).toHaveURL('/appointments');
  });

  test('two tabs share one session without tripping the stolen-token check', async ({
    page,
    context,
  }) => {
    await signIn(context, RECEPTIONIST);
    const second = await context.newPage();
    await Promise.all([page.goto('/appointments'), second.goto('/scheduler')]);
    await expect(pageHeading(page, 'Appointments')).toBeVisible();
    await expect(pageHeading(second, 'Scheduler')).toBeVisible();

    // Both renew their token at the same moment, each with the cookie the other just rotated.
    await Promise.all([page.reload(), second.reload()]);
    await expect(pageHeading(page, 'Appointments')).toBeVisible();
    await expect(pageHeading(second, 'Scheduler')).toBeVisible();
  });
});

test.describe('Logging out', () => {
  test('ends the session, and the refresh cookie with it', async ({ page, context }) => {
    await openAs(page, RECEPTIONIST, '/');
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL('/login');
    expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain(REFRESH_COOKIE);

    await page.goto('/appointments');
    await expect(page).toHaveURL('/login');
  });

  test('in one tab logs out the others', async ({ page, context }) => {
    await signIn(context, RECEPTIONIST);
    const other = await context.newPage();
    await Promise.all([page.goto('/'), other.goto('/appointments')]);
    await expect(pageHeading(other, 'Appointments')).toBeVisible();

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL('/login');
    await expect(other).toHaveURL('/login');
  });
});
