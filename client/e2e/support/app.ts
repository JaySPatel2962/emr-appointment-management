import type { Locator, Page, TestInfo } from '@playwright/test';

import { expect, signIn } from './fixtures';
import type { Account } from './seed-data';

// How the tests find their way around the app: by role and accessible name, as a person using
// a screen reader would, never by CSS class.

/** Signs in and opens `path`, once its page heading shows. */
export const openAs = async (page: Page, account: Account, path: string): Promise<void> => {
  await signIn(page.context(), account);
  await page.goto(path);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
};

export const logInWithForm = async (page: Page, account: Account): Promise<void> => {
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Log in' }).click();
};

export const pageHeading = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('heading', { level: 1, name });

/** A link of the main navigation (the side bar, or the menu on small screens). */
export const navLink = (page: Page, name: string): Locator =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true });

/**
 * A date as the app writes it ("Monday, 19 October 2026"), formatted by the browser itself so
 * the expectation can't drift from what the page shows.
 */
export const longDate = (page: Page, date: string): Promise<string> =>
  page.evaluate(
    (day) =>
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'UTC',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(`${day}T00:00:00Z`)),
    date,
  );

/** Opens the date picker named `field` and picks `date`, moving month by month to it. */
export const pickDate = async (page: Page, field: string, date: string): Promise<void> => {
  await page.getByRole('button', { name: new RegExp(`^${field}\\b`) }).click();
  const calendar = page.getByRole('dialog').filter({ has: page.getByRole('grid') });
  const day = calendar.getByRole('button', { name: await longDate(page, date), exact: true });
  for (let month = 0; month < 24 && (await day.count()) === 0; month += 1) {
    await calendar.getByRole('button', { name: 'Next month' }).click();
  }
  await day.click();
  await expect(calendar).toBeHidden();
};

export const toast = (page: Page, text: string | RegExp): Locator =>
  page.getByRole('region', { name: 'Notifications' }).getByText(text);

// The scheduler's day sheet: one region per session, a list item per slot.

const daySheet = (page: Page): Locator => page.getByRole('region', { name: /session$/ });

/** Every slot tile, in time order. */
export const slotTiles = (page: Page): Locator => daySheet(page).getByRole('listitem');

/** The tile of the slot starting at `time` ("HH:mm"). */
export const slotTile = (page: Page, time: string): Locator =>
  slotTiles(page).filter({ has: page.getByText(time, { exact: true }) });

export const freeSlotLink = (page: Page, time: string): Locator =>
  slotTile(page, time).getByRole('link', { name: /book this slot/ });

export const bookedSlotButton = (page: Page, time: string): Locator =>
  slotTile(page, time).getByRole('button', { name: /booked/ });

/** The start times shown on the day sheet. */
export const slotTimes = async (page: Page): Promise<string[]> =>
  (await slotTiles(page).allInnerTexts()).map((text) => text.trim().slice(0, 5));

/** Waits until the scheduler receives other people's changes as they happen. */
export const expectLive = (page: Page): Promise<void> =>
  expect(page.getByText(/^Live updates:\s*Live$/)).toBeVisible();

// The booking form.

/** A slot of the booking form's time picker (a radio button named "10:00 Available", say). */
export const slotOption = (page: Page, time: string): Locator =>
  page.getByRole('group', { name: 'Time' }).getByRole('radio', { name: new RegExp(`^${time}`) });

/** Clicks a choice of a radio group whose radio buttons are visually hidden, as a person would. */
export const chooseOption = (page: Page, group: string | RegExp, label: string): Promise<void> =>
  page
    .getByRole('group', { name: group })
    .locator('label')
    .filter({ hasText: new RegExp(`^${label}`) })
    .first()
    .click();

export const chooseSlot = (page: Page, time: string): Promise<void> =>
  chooseOption(page, 'Time', time);

export const choosePatientMode = (page: Page, mode: 'Existing patient' | 'New patient') =>
  chooseOption(page, 'Who is the appointment for?', mode);

/** Searches for a registered patient and picks the result named `name`. */
export const findPatient = async (page: Page, term: string, name: string): Promise<void> => {
  await page.getByLabel('Find the patient').fill(term);
  // Clicked rather than checked: picking a patient replaces the results with their card.
  await page.getByRole('radio', { name: new RegExp(name) }).click();
  await expect(page.getByRole('button', { name: 'Change patient' })).toBeVisible();
};

/** The booking page for one doctor, day and slot, as a free tile on the scheduler links to it. */
export const bookingPath = (doctorId: string, date: string, slot?: string): string => {
  // Encoded as the app encodes it (":" becomes "%3A"), so it can be compared with the address.
  const search = new URLSearchParams({ doctor: doctorId, date, ...(slot ? { slot } : {}) });
  return `/appointments/new?${search.toString()}`;
};

export const schedulerPath = (doctorId: string, date: string): string =>
  `/scheduler?doctor=${doctorId}&date=${date}`;

// The appointment list.

export const listPath = (params: Record<string, string | number> = {}): string => {
  const search = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString();
  return search === '' ? '/appointments' : `/appointments?${search}`;
};

/** The list's rows, in order (each a table row, or a card on narrow screens). */
export const listRows = (page: Page): Locator =>
  page.getByRole('table', { name: 'Appointments' }).getByRole('rowgroup').nth(1).getByRole('row');

/** The text of one column ("Patient", "Status", ...) for every row on the page. */
export const columnTexts = async (page: Page, header: string): Promise<string[]> =>
  (await listRows(page).locator(`[data-label="${header}"]`).allInnerTexts()).map((text) =>
    text.trim(),
  );

/** The row of the patient's appointment. */
export const listRow = (page: Page, patientName: string): Locator =>
  listRows(page).filter({ has: page.getByRole('button', { name: patientName, exact: true }) });

/** A row's status badge. */
export const statusOf = (row: Locator): Locator => row.locator('[data-label="Status"]');

/** The first line of a column's cells: the name above the detail. */
const firstLines = async (page: Page, header: string): Promise<string[]> =>
  (await columnTexts(page, header)).map((text) => text.split('\n')[0] ?? '');

export const patientNames = (page: Page): Promise<string[]> => firstLines(page, 'Patient');

export const doctorNames = (page: Page): Promise<string[]> => firstLines(page, 'Doctor');

export const listSummary = (page: Page): Locator => page.getByText(/^Showing .+ of \d+ /);

/** What the list says above its pages: "Showing 21–25 of 25 appointments". */
export const summaryText = (total: number, pageNumber = 1, limit = 20): string => {
  const first = (pageNumber - 1) * limit + 1;
  const last = Math.min(pageNumber * limit, total);
  const range = total === 0 ? '0' : first === last ? String(first) : `${first}–${last}`;
  return `Showing ${range} of ${total} appointments`;
};

// Evidence and layout.

/** Attaches a full-page screenshot to the test's report. */
export const screenshot = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
};

/** How far the page scrolls sideways: 0 when nothing is wider than the window. */
export const horizontalOverflow = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
