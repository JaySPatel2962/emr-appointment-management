import type { Locator, Page } from '@playwright/test';

import { ensureBooked } from './support/api';
import {
  bookingPath,
  horizontalOverflow,
  listPath,
  listRows,
  listSummary,
  pageHeading,
  schedulerPath,
  screenshot,
  slotOption,
  slotTiles,
} from './support/app';
import { suiteDate } from './support/dates';
import { seedInfo } from './support/env';
import { apiAs, expect, signIn, test } from './support/fixtures';
import { ADMIN } from './support/seed-data';

const DAY = suiteDate('responsive');

const SIZES = [
  { name: 'phone', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

interface Screen {
  name: string;
  path: string;
  heading: string;
  /** What shows once the page has its data. */
  ready: (page: Page) => Locator;
}

const screens = (): Screen[] => {
  const { doctors, listDays } = seedInfo();
  return [
    {
      name: 'dashboard',
      path: '/',
      heading: 'Today at the clinic',
      ready: (page) => page.getByText('Still to come', { exact: true }),
    },
    {
      name: 'scheduler',
      path: schedulerPath(doctors.kavya.id, DAY),
      heading: 'Scheduler',
      ready: (page) => slotTiles(page).first(),
    },
    {
      name: 'booking',
      path: bookingPath(doctors.kavya.id, DAY, '09:30'),
      heading: 'Book an appointment',
      ready: (page) => slotOption(page, '09:30'),
    },
    {
      name: 'list',
      path: listPath({ dateFrom: listDays.kavya, dateTo: listDays.arjun }),
      heading: 'Appointments',
      ready: listSummary,
    },
    {
      name: 'schedules',
      path: `/admin?tab=schedules&doctor=${doctors.arjun.id}`,
      heading: 'Staff and schedules',
      ready: (page) => page.getByRole('heading', { name: "Dr. Arjun Rao's schedule" }),
    },
    {
      name: 'add-doctor',
      path: '/admin?tab=doctor',
      heading: 'Staff and schedules',
      ready: (page) => page.getByRole('button', { name: 'Add doctor' }),
    },
    {
      name: 'not-found',
      path: '/no-such-page',
      heading: 'Page not found',
      ready: (page) => page.getByRole('link', { name: 'Go to the dashboard' }),
    },
  ];
};

test.beforeAll(async () => {
  const { doctors, patients } = seedInfo();
  await ensureBooked(await apiAs(ADMIN), {
    doctorId: doctors.kavya.id,
    date: DAY,
    slotStart: '09:00',
    purpose: 'A long purpose, to see that long text wraps instead of widening the page',
    patientId: patients.lakshmi.id,
  });
});

for (const size of SIZES) {
  test.describe(`${size.width}px wide (${size.name})`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('no page scrolls sideways', async ({ page }, testInfo) => {
      await page.goto('/login');
      await expect(pageHeading(page, 'Log in')).toBeVisible();
      expect(await horizontalOverflow(page), 'login').toBe(0);
      await screenshot(page, testInfo, `${size.width}-login`);

      await signIn(page.context(), ADMIN);
      for (const screen of screens()) {
        await page.goto(screen.path);
        await expect(pageHeading(page, screen.heading)).toBeVisible();
        await expect(screen.ready(page)).toBeVisible();
        expect(await horizontalOverflow(page), screen.name).toBe(0);
        await screenshot(page, testInfo, `${size.width}-${screen.name}`);
      }
    });

    test('the navigation and the list fit the screen', async ({ page }) => {
      const { listDays } = seedInfo();
      await signIn(page.context(), ADMIN);
      await page.goto(listPath({ dateFrom: listDays.kavya, dateTo: listDays.arjun }));
      await expect(listSummary(page)).toBeVisible();
      const menuButton = page.getByRole('button', { name: 'Open menu' });
      const sidebar = page.getByRole('complementary');
      const rowDisplay = await listRows(page)
        .first()
        .evaluate((row) => getComputedStyle(row).display);

      if (size.width < 1024) {
        // The menu folds into a drawer.
        await expect(sidebar).toBeHidden();
        await menuButton.click();
        const menu = page.getByRole('dialog', { name: 'Menu' });
        await menu.getByRole('link', { name: 'Scheduler' }).click();
        await expect(pageHeading(page, 'Scheduler')).toBeVisible();
        await expect(menu).toBeHidden();
      } else {
        await expect(sidebar).toBeVisible();
        await expect(menuButton).toBeHidden();
      }
      // Rows are cards where the table would not fit (it needs 48rem; the menu takes room too).
      expect(rowDisplay).toBe(size.width < 1024 ? 'flex' : 'table-row');
    });
  });
}
