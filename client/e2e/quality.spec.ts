import type { Page } from '@playwright/test';

import { expectAccessible } from './support/a11y';
import { book, ensureBooked } from './support/api';
import {
  bookedSlotButton,
  bookingPath,
  choosePatientMode,
  expectLive,
  listPath,
  listRow,
  listRows,
  logInWithForm,
  navLink,
  openAs,
  pageHeading,
  schedulerPath,
  slotTiles,
  statusOf,
} from './support/app';
import { suiteDate } from './support/dates';
import { seedInfo } from './support/env';
import { apiAs, expect, test } from './support/fixtures';
import {
  installRenderProbe,
  readRenderStats,
  resetRenderStats,
  waitForRenderIdle,
} from './support/render-probe';
import { ADMIN, KAVYA, PATIENT_KEYS, RECEPTIONIST } from './support/seed-data';

const DAY = suiteDate('quality');
const TIMES = ['09:00', '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45'] as const;

/** A description of what has keyboard focus, for focus assertions. */
const focusedElement = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const element = document.activeElement;
    if (!element) {
      return 'nothing';
    }
    const name = element.getAttribute('aria-label') ?? element.textContent;
    return `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''} ${name.trim()}`;
  });

/** Whether focus is somewhere on the page other than inside an open dialog. */
const focusLeftDialog = (page: Page): Promise<boolean> =>
  page.evaluate(
    () => document.activeElement !== document.body && !document.activeElement?.closest('dialog'),
  );

test.beforeAll(async () => {
  const { doctors, patients } = seedInfo();
  const admin = await apiAs(ADMIN);
  for (const [index, slotStart] of TIMES.entries()) {
    const patient = PATIENT_KEYS[index % PATIENT_KEYS.length] ?? 'asha';
    await ensureBooked(admin, {
      doctorId: doctors.kavya.id,
      date: DAY,
      slotStart,
      purpose: 'Annual check-up',
      patientId: patients[patient].id,
    });
  }
});

test.describe('Accessibility (axe-core, WCAG 2.2 AA)', () => {
  test('the login page, with and without errors', async ({ page }) => {
    await page.goto('/login');
    await expect(pageHeading(page, 'Log in')).toBeVisible();
    await expectAccessible(page, 'login');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Enter your email address')).toBeVisible();
    await expectAccessible(page, 'login with errors');
  });

  test("the front desk's pages and dialogs", async ({ page }) => {
    const { doctors } = seedInfo();
    await openAs(page, ADMIN, '/');
    await expect(page.getByText('Still to come', { exact: true })).toBeVisible();
    await expectAccessible(page, 'dashboard');

    await page.goto(schedulerPath(doctors.kavya.id, DAY));
    await expect(slotTiles(page).first()).toBeVisible();
    await expectAccessible(page, 'scheduler');
    await bookedSlotButton(page, '09:00').click();
    await expect(page.getByRole('dialog', { name: 'Appointment' })).toContainText(
      'Annual check-up',
    );
    await expectAccessible(page, 'appointment details');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Date\b/ }).click();
    await expect(page.getByRole('grid')).toBeVisible();
    await expectAccessible(page, 'date picker');
    await page.keyboard.press('Escape');

    await page.goto(listPath({ dateFrom: DAY, dateTo: DAY }));
    await expect(listRows(page)).toHaveCount(TIMES.length);
    await expectAccessible(page, 'appointment list');
    await page
      .getByRole('button', { name: /^Edit .+'s appointment$/ })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Edit appointment' })).toBeVisible();
    await expectAccessible(page, 'edit dialog');
    await page.keyboard.press('Escape');
    await page
      .getByRole('button', { name: /^Cancel .+'s appointment$/ })
      .first()
      .click();
    await expect(page.getByRole('dialog', { name: 'Cancel this appointment?' })).toBeVisible();
    await expectAccessible(page, 'cancel dialog');
    await page.keyboard.press('Escape');

    await page.goto(bookingPath(doctors.kavya.id, DAY, '11:00'));
    await page.getByLabel('Find the patient').fill('as');
    await expect(page.getByRole('group', { name: 'Matching patients' })).toBeVisible();
    await expectAccessible(page, 'booking, search results');
    await choosePatientMode(page, 'New patient');
    await page.getByRole('button', { name: 'Book appointment' }).click();
    await expect(page.getByText("Enter the patient's name")).toBeVisible();
    await expectAccessible(page, 'booking, new patient with errors');

    for (const tab of ['schedules', 'doctor', 'receptionist']) {
      await page.goto(`/admin?tab=${tab}`);
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await expectAccessible(page, `admin, ${tab} tab`);
    }
    await page.goto(`/admin?tab=schedules&doctor=${doctors.arjun.id}`);
    await expect(page.getByRole('heading', { name: "Dr. Arjun Rao's schedule" })).toBeVisible();
    await expectAccessible(page, 'schedule editor');

    await page.goto('/no-such-page');
    await expect(pageHeading(page, 'Page not found')).toBeVisible();
    await expectAccessible(page, 'not found');
  });

  test("a doctor's pages", async ({ page }) => {
    await openAs(page, KAVYA, '/');
    await expectAccessible(page, 'doctor dashboard');
    await page.goto(`/scheduler?date=${DAY}`);
    await expect(slotTiles(page).first()).toBeVisible();
    await expectAccessible(page, 'doctor scheduler');
    await page.goto('/admin');
    await expect(pageHeading(page, "You don't have access to this page")).toBeVisible();
    await expectAccessible(page, 'no access');
  });

  test('a phone: the menu and the list as cards', async ({ openWindow }) => {
    const page = await openWindow(RECEPTIONIST, { viewport: { width: 375, height: 812 } });
    await page.goto(listPath({ dateFrom: DAY, dateTo: DAY }));
    await expect(listRows(page)).toHaveCount(TIMES.length);
    await expectAccessible(page, 'appointment list on a phone');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await expectAccessible(page, 'menu on a phone');
  });
});

test.describe('Keyboard and focus', () => {
  test('logging in works from the keyboard alone', async ({ page }) => {
    await page.goto('/login');
    await expect(pageHeading(page, 'Log in')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Email')).toBeFocused();
    await page.keyboard.type(RECEPTIONIST.email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(RECEPTIONIST.password);
    await page.keyboard.press('Enter');
    await expect(pageHeading(page, 'Today at the clinic')).toBeVisible();
  });

  test('the skip link and page changes move focus to the content', async ({ page }) => {
    await openAs(page, RECEPTIONIST, '/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();

    await navLink(page, 'Appointments').click();
    await expect(pageHeading(page, 'Appointments')).toBeVisible();
    await expect(page.getByRole('main')).toBeFocused();
    await expect(page).toHaveTitle(/^Appointments/);
  });

  test('a dialog keeps focus inside, and gives it back when closed', async ({ page }) => {
    const { doctors } = seedInfo();
    await openAs(page, RECEPTIONIST, schedulerPath(doctors.kavya.id, DAY));
    const tile = bookedSlotButton(page, '09:15');
    await tile.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Appointment' })).toBeVisible();
    expect(await focusedElement(page)).toContain('Close');

    for (let step = 0; step < 10; step += 1) {
      await page.keyboard.press('Tab');
      expect(await focusLeftDialog(page)).toBe(false);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Appointment' })).toBeHidden();
    await expect(tile).toBeFocused();
  });

  test('the admin tabs follow the arrow keys, and the address follows the tab', async ({
    page,
  }) => {
    await openAs(page, ADMIN, '/admin');
    await page.getByRole('tab', { name: 'Doctors and schedules' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Add a doctor' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Add a doctor' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: 'Add a receptionist' })).toBeFocused();
    await expect(page).toHaveURL('/admin?tab=receptionist');
  });

  test('the phone menu traps focus, and Esc gives it back to the menu button', async ({
    openWindow,
  }) => {
    const page = await openWindow(RECEPTIONIST, { viewport: { width: 375, height: 812 } });
    await page.goto('/');
    const menuButton = page.getByRole('button', { name: 'Open menu' });
    await menuButton.click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      expect(await focusLeftDialog(page)).toBe(false);
    }
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();

    await menuButton.click();
    await menu.getByRole('link', { name: 'Appointments' }).click();
    await expect(pageHeading(page, 'Appointments')).toBeVisible();
    await expect(menu).toBeHidden();
  });
});

test.describe('Rendering and network', () => {
  test('a live change re-renders only its slot, and an idle grid sends nothing', async ({
    page,
  }) => {
    const { doctors, patients } = seedInfo();
    await installRenderProbe(page);
    await openAs(page, RECEPTIONIST, schedulerPath(doctors.kavya.id, DAY));
    await expectLive(page);
    const tiles = await slotTiles(page).count();
    expect(tiles).toBeGreaterThan(50);
    await waitForRenderIdle(page);

    // Left alone, the grid neither renders nor asks the API for anything. (The clinic clock
    // may tick over a minute meanwhile: one commit, in which no tile renders.)
    let requests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/v1/')) {
        requests += 1;
      }
    });
    await resetRenderStats(page, 'section[aria-label$="session"] li');
    await page.waitForTimeout(3000);
    const idle = await readRenderStats(page);
    expect(idle.commits).toBeLessThanOrEqual(1);
    expect(idle.scopes).toEqual([]);
    expect(requests).toBe(0);

    // A booking from another desk changes one tile of the dozens on screen.
    await book(await apiAs(ADMIN), {
      doctorId: doctors.kavya.id,
      date: DAY,
      slotStart: '18:00',
      purpose: 'Medication review',
      patientId: patients.ravi.id,
    });
    await expect(bookedSlotButton(page, '18:00')).toBeVisible();
    await waitForRenderIdle(page);
    const { scopes } = await readRenderStats(page);
    // Of the tiles, only 18:00's. (A break band is a plain line of text that re-renders with
    // the grid; memoizing it would cost more than it saves.)
    const changedTiles = scopes.filter((text) => /^\d{2}:\d{2}/.test(text));
    expect(changedTiles).toEqual([expect.stringMatching(/^18:00/)]);
  });

  test('an action on one row of the list re-renders that row alone', async ({ page }) => {
    await installRenderProbe(page);
    await openAs(page, RECEPTIONIST, listPath({ dateFrom: DAY, dateTo: DAY }));
    const row = listRow(page, 'Gita Sharma');
    await expect(row).toBeVisible();
    await waitForRenderIdle(page);

    await resetRenderStats(page, 'tbody > tr');
    await row.getByRole('button', { name: 'Mark Gita Sharma as arrived' }).click();
    await expect(statusOf(row)).toHaveText('Arrived');
    await waitForRenderIdle(page);
    const { scopes } = await readRenderStats(page);
    expect(scopes).toHaveLength(1);
    expect(scopes[0]).toContain('Gita Sharma');
  });
});

test('signing in again after logging out starts a clean session', async ({ page }) => {
  await openAs(page, RECEPTIONIST, '/');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/login');
  await logInWithForm(page, KAVYA);
  await expect(pageHeading(page, 'Your day')).toBeVisible();
  // Nothing of the receptionist's session is left: the doctor's menu, the doctor's data.
  await expect(navLink(page, 'Book appointment')).toHaveCount(0);
  await expect(page.getByRole('complementary').getByText(KAVYA.name)).toBeVisible();
});
