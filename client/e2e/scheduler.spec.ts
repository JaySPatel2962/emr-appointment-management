import type { Locator } from '@playwright/test';

import { ensureBooked } from './support/api';
import {
  bookedSlotButton,
  bookingPath,
  freeSlotLink,
  longDate,
  openAs,
  pageHeading,
  schedulerPath,
  screenshot,
  slotOption,
  slotTile,
  slotTiles,
  slotTimes,
} from './support/app';
import { addDays, clinicMinutes, clinicToday, nextDateOn, suiteDate } from './support/dates';
import { seedInfo } from './support/env';
import { apiAs, expect, test } from './support/fixtures';
import {
  ADMIN,
  ARJUN,
  KAVYA,
  MONDAY_TO_SATURDAY,
  PATIENTS,
  RECEPTIONIST,
} from './support/seed-data';

const DAY = suiteDate('scheduler');

/** What makes a tile look the way it does: its fill, its hatching and its left edge. */
const lookOf = (tile: Locator): Promise<string> =>
  tile.locator(':scope > *').evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.backgroundImage, style.borderLeftWidth].join(' | ');
  });

test.beforeAll(async () => {
  const { doctors, patients } = seedInfo();
  await ensureBooked(await apiAs(ADMIN), {
    doctorId: doctors.kavya.id,
    date: DAY,
    slotStart: '09:00',
    purpose: 'Follow-up after ECG',
    patientId: patients.asha.id,
  });
});

test('the department narrows the doctors, and the address keeps the choice', async ({ page }) => {
  const { doctors } = seedInfo();
  await openAs(page, RECEPTIONIST, '/scheduler');
  await expect(page.getByRole('heading', { name: 'Choose a doctor' })).toBeVisible();
  const department = page.getByLabel('Department', { exact: true });
  const doctor = page.getByLabel('Doctor', { exact: true });

  await department.selectOption({ label: 'Dermatology' });
  await expect(doctor.locator('option')).toHaveText(['Choose a doctor', ARJUN.name]);
  await doctor.selectOption({ label: ARJUN.name });
  await expect(page.getByRole('heading', { level: 2, name: ARJUN.name })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`doctor=${doctors.arjun.id}`));
  await expect(page).toHaveURL(new RegExp(`department=${doctors.arjun.departmentId}`));

  // A doctor from another department doesn't fit the new filter, so the choice is dropped.
  await department.selectOption({ label: 'Cardiology' });
  await expect(doctor).toHaveValue('');
  await expect(page).not.toHaveURL(/doctor=/);
  await expect(doctor.locator('option')).toHaveText(['Choose a doctor', KAVYA.name]);

  await doctor.selectOption({ label: KAVYA.name });
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: KAVYA.name })).toBeVisible();
  await expect(department).toHaveValue(doctors.kavya.departmentId);
  await expect(doctor).toHaveValue(doctors.kavya.id);
});

test('days before today cannot be chosen', async ({ page }) => {
  const { doctors } = seedInfo();
  const today = clinicToday();
  const yesterday = addDays(today, -1);
  await openAs(page, RECEPTIONIST, schedulerPath(doctors.kavya.id, today));
  await expect(page.getByRole('button', { name: 'Previous day' })).toBeDisabled();

  await page.getByRole('button', { name: /^Date\b/ }).click();
  const calendar = page.getByRole('dialog').filter({ has: page.getByRole('grid') });
  if (yesterday.slice(0, 7) === today.slice(0, 7)) {
    const past = calendar.getByRole('button', {
      name: `${await longDate(page, yesterday)}, unavailable`,
    });
    await expect(past).toHaveAttribute('aria-disabled', 'true');
    // Playwright won't click a disabled control on its own; a person still can.
    await past.click({ force: true });
    // Nothing was picked: the calendar stays open, and the day is still today.
    await expect(calendar).toBeVisible();
    await expect(page).not.toHaveURL(new RegExp(`date=${yesterday}`));
  } else {
    await expect(calendar.getByRole('button', { name: 'Previous month' })).toBeDisabled();
  }
  await page.keyboard.press('Escape');
  await expect(calendar).toBeHidden();

  // An address with a past date shows today instead.
  await page.goto(schedulerPath(doctors.kavya.id, addDays(today, -3)));
  await expect(page.getByText(await longDate(page, today), { exact: true })).toBeVisible();
});

test('past, free and booked slots each look different', async ({ page }, testInfo) => {
  const { doctors } = seedInfo();
  await openAs(page, RECEPTIONIST, schedulerPath(doctors.kavya.id, clinicToday()));
  // Today's first slot started at midnight, so it is past whenever the suite runs.
  const past = slotTile(page, '00:00');
  await expect(past).toContainText('Past');
  await expect(past.getByRole('link')).toHaveCount(0);
  await expect(past.getByRole('button')).toHaveCount(0);
  if (clinicMinutes() < 23 * 60) {
    await expect(freeSlotLink(page, '23:30')).toBeVisible();
  }
  const pastLook = await lookOf(past);
  await screenshot(page, testInfo, 'scheduler-today');

  await page.goto(schedulerPath(doctors.kavya.id, DAY));
  await expect(bookedSlotButton(page, '09:00')).toContainText(PATIENTS.asha.name);
  await expect(bookedSlotButton(page, '09:00')).toContainText('Scheduled');
  await expect(freeSlotLink(page, '09:15')).toContainText('Available');
  const looks = new Set([
    pastLook,
    await lookOf(slotTile(page, '09:00')),
    await lookOf(slotTile(page, '09:15')),
  ]);
  expect(looks.size).toBe(3);
  await expect(page.getByRole('list', { name: 'Slots' })).toContainText('1 booked');
  await screenshot(page, testInfo, 'scheduler-day');
});

test('no slot is offered in a break, or between sessions', async ({ page }) => {
  const { doctors } = seedInfo();
  await openAs(page, RECEPTIONIST, schedulerPath(doctors.kavya.id, DAY));
  await expect(slotTiles(page).first()).toBeVisible();
  const times = await slotTimes(page);
  expect(times).toEqual(expect.arrayContaining(['11:45', '13:00', '17:00']));
  expect(times.filter((time) => time >= '12:00' && time < '13:00')).toEqual([]);
  expect(times.filter((time) => time >= '14:00' && time < '17:00')).toEqual([]);
  await expect(page.getByText('Break, 12:00–13:00, no appointments')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Morning session' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Evening session' })).toBeVisible();

  const workday = nextDateOn(DAY, MONDAY_TO_SATURDAY);
  await page.goto(schedulerPath(doctors.arjun.id, workday));
  await expect(page.getByRole('heading', { level: 2, name: ARJUN.name })).toBeVisible();
  await expect(slotTiles(page).first()).toBeVisible();
  const his = await slotTimes(page);
  expect(his).toEqual(expect.arrayContaining(['12:00', '13:00']));
  expect(his.filter((time) => time > '12:00' && time < '13:00')).toEqual([]);
  await expect(page.getByText('Break, 12:20–13:00, no appointments')).toBeVisible();
});

test('a free slot opens booking for it, and a booked slot its details', async ({ page }) => {
  const { doctors } = seedInfo();
  await openAs(page, RECEPTIONIST, schedulerPath(doctors.kavya.id, DAY));

  await freeSlotLink(page, '09:15').click();
  await expect(page).toHaveURL(bookingPath(doctors.kavya.id, DAY, '09:15'));
  await expect(pageHeading(page, 'Book an appointment')).toBeVisible();
  await expect(page.getByLabel('Doctor', { exact: true })).toHaveValue(doctors.kavya.id);
  await expect(slotOption(page, '09:15')).toBeChecked();

  await page.goBack();
  await bookedSlotButton(page, '09:00').click();
  const details = page.getByRole('dialog', { name: 'Appointment' });
  await expect(details).toContainText(PATIENTS.asha.name);
  await expect(details).toContainText('Follow-up after ECG');
  await page.keyboard.press('Escape');
  await expect(details).toBeHidden();
  await expect(bookedSlotButton(page, '09:00')).toBeFocused();
});

test("a doctor's day off says so and offers their next working day", async ({ page }) => {
  const { doctors } = seedInfo();
  const sunday = nextDateOn(DAY, [0]);
  await openAs(page, RECEPTIONIST, schedulerPath(doctors.arjun.id, sunday));
  await expect(
    page.getByRole('heading', { name: `${ARJUN.name} has no sessions on Sundays` }),
  ).toBeVisible();

  await page.getByRole('button', { name: /^Show / }).click();
  await expect(page).toHaveURL(new RegExp(`date=${addDays(sunday, 1)}`));
  await expect(slotTiles(page).first()).toBeVisible();
});

test("the clinic's clock decides what today is, not the browser's timezone", async ({
  openWindow,
}) => {
  const { doctors } = seedInfo();
  // A laptop set to California, half a day behind the clinic.
  const page = await openWindow(RECEPTIONIST, { timezoneId: 'America/Los_Angeles' });
  await page.goto(`/scheduler?doctor=${doctors.kavya.id}`);
  await expect(page.getByText(await longDate(page, clinicToday()), { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Previous day' })).toBeDisabled();
  await expect(slotTile(page, '00:00')).toContainText('Past');
});
