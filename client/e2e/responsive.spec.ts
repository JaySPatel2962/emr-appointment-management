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

// Words that can't wrap at a space: a long name, and a list of tests joined by "/". Manual QA
// found that text like this widened its tile, its table column or its page.
const LONG_NAME = 'Srivenkatanarasimharajuvaripetasubrahmanyamsastry';
const LONG_PURPOSE = 'ECG/ECHO/TMT/Holter/LipidProfile/HbA1c/TSH/CBC/LFT/KFT/UrineRoutine';

// The narrowest time box that shows "09:00" next to Chromium's clock button, with the fields'
// 12 px padding (measured in the manual retest).
const TIME_BOX_MIN_WIDTH = 104;

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
  await ensureBooked(await apiAs(ADMIN), {
    doctorId: doctors.kavya.id,
    date: DAY,
    slotStart: '09:15',
    purpose: LONG_PURPOSE,
    newPatient: { name: LONG_NAME, mobile: '9811144455', gender: 'MALE' },
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

    test('long words stay inside their tiles, rows and forms', async ({ page }) => {
      const { doctors } = seedInfo();
      await signIn(page.context(), ADMIN);

      // The slot tile truncates the name instead of growing past its cell.
      await page.goto(schedulerPath(doctors.kavya.id, DAY));
      await expect(slotTiles(page).filter({ hasText: '09:15' })).toBeVisible();
      const widerThanCell = await slotTiles(page).evaluateAll(
        (cells) =>
          cells.filter((cell) => {
            const tile = cell.firstElementChild;
            return tile !== null && tile.scrollWidth > cell.clientWidth + 1;
          }).length,
      );
      expect(widerThanCell, 'tiles wider than their cell').toBe(0);
      expect(await horizontalOverflow(page), 'scheduler').toBe(0);

      // The row's actions stay inside the table's card.
      await page.goto(listPath({ patientName: LONG_NAME.slice(0, 12) }));
      await expect(listRows(page)).toHaveCount(1);
      const clipped = await listRows(page)
        .first()
        .evaluate((row) => {
          const card = row.closest('.overflow-hidden')?.getBoundingClientRect();
          const buttons = [...row.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
          return card ? Math.max(0, ...buttons.map((b) => b.right - card.right)) : -1;
        });
      expect(clipped, 'row actions cut off by').toBe(0);
      expect(await horizontalOverflow(page), 'list').toBe(0);

      // The booking form's search result and chosen patient wrap.
      await page.goto(bookingPath(doctors.kavya.id, DAY));
      await page.getByLabel('Find the patient').fill(LONG_NAME.slice(0, 12));
      await page.getByRole('radio', { name: new RegExp(LONG_NAME) }).click();
      await expect(page.getByRole('button', { name: 'Change patient' })).toBeVisible();
      expect(await horizontalOverflow(page), 'booking').toBe(0);
    });

    // Found in the manual retest: on a phone each time box in the schedule editor was 88 px wide,
    // so "09:00" read "09:0".
    test('the schedule editor shows each time in full', async ({ page }) => {
      const { doctors } = seedInfo();
      await signIn(page.context(), ADMIN);
      await page.goto(`/admin?tab=schedules&doctor=${doctors.arjun.id}`);
      await expect(page.getByLabel('Monday session 1 starts')).toBeVisible();
      const narrowest = await page
        .locator('input[type="time"]')
        .evaluateAll((inputs) =>
          Math.min(...inputs.map((input) => input.getBoundingClientRect().width)),
        );
      expect(narrowest, 'the narrowest time box, in px').toBeGreaterThanOrEqual(TIME_BOX_MIN_WIDTH);
      expect(await horizontalOverflow(page), 'schedule editor').toBe(0);
    });

    // Found in the manual retest: at 768 px the list showed cards with no sort control at all,
    // and sorting by booking time needed a screen about 1,500 px wide.
    test('every sort can be chosen', async ({ page }) => {
      await signIn(page.context(), ADMIN);
      await page.goto(listPath());
      await expect(listSummary(page)).toBeVisible();
      // A header row turned into cards is still read out, but only 1 px of it is on screen.
      const onScreen = await page.getByRole('columnheader').evaluateAll((cells) =>
        cells
          .filter((cell) => {
            const button = cell.querySelector('button');
            const head = cell.closest('thead');
            return (
              button !== null &&
              head !== null &&
              head.getBoundingClientRect().width > 1 &&
              button.getBoundingClientRect().width > 1
            );
          })
          .map((cell) => cell.textContent.trim()),
      );
      if (onScreen.length < 5) {
        const choice = page.getByLabel('Sort by');
        await expect(choice, `sortable headers on screen: ${onScreen.join(', ')}`).toBeVisible();
        await expect(choice.locator('option')).toHaveCount(10);
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
