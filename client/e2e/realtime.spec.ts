import type { Page } from '@playwright/test';

import { book } from './support/api';
import {
  bookedSlotButton,
  bookingPath,
  expectLive,
  findPatient,
  freeSlotLink,
  listPath,
  navLink,
  openAs,
  schedulerPath,
  toast,
} from './support/app';
import { addDays, suiteDate } from './support/dates';
import { seedInfo } from './support/env';
import { apiAs, expect, test } from './support/fixtures';
import { eventsNamed, recordSocketTraffic } from './support/socket';
import { ADMIN, PATIENTS, RECEPTIONIST } from './support/seed-data';

const DAY = suiteDate('realtime');
const NEXT_DAY = addDays(DAY, 1);

/** Sets a flag that only a full page load would clear. */
const markPage = (page: Page): Promise<void> =>
  page.evaluate(() => {
    document.documentElement.dataset.e2eMarked = 'yes';
  });

test('a booking, its updates and its cancellation in another window appear live', async ({
  page,
  openWindow,
}) => {
  const { doctors } = seedInfo();
  const watcher = page;
  const traffic = recordSocketTraffic(watcher);
  await openAs(watcher, RECEPTIONIST, schedulerPath(doctors.kavya.id, DAY));
  await expectLive(watcher);
  await expect
    .poll(() => eventsNamed(traffic.sent, 'scheduler:join').map(({ data }) => data))
    .toContainEqual({ doctorId: doctors.kavya.id, date: DAY });
  await markPage(watcher);
  const marked = watcher.locator('html[data-e2e-marked="yes"]');

  // Someone at another desk books 11:00.
  const desk = await openWindow(ADMIN);
  await desk.goto(bookingPath(doctors.kavya.id, DAY, '11:00'));
  await findPatient(desk, 'Meera', PATIENTS.meera.name);
  await desk.getByLabel('Purpose of the visit').fill('Chest pain review');
  await desk.getByRole('button', { name: 'Book appointment' }).click();
  await expect(toast(desk, /^Booked Meera Iyer/)).toBeVisible();

  await expect(bookedSlotButton(watcher, '11:00')).toContainText(PATIENTS.meera.name);
  await expect(watcher.getByText('11:00 was just booked for Meera Iyer.')).toBeAttached();

  // They change the purpose, then check her in.
  await desk.goto(listPath({ dateFrom: DAY, dateTo: DAY }));
  await desk.getByRole('button', { name: "Edit Meera Iyer's appointment" }).click();
  const edit = desk.getByRole('dialog', { name: 'Edit appointment' });
  await edit.getByLabel('Purpose of the visit').fill('Chest pain, second opinion');
  await edit.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(desk, 'Changes saved')).toBeVisible();
  await expect(watcher.getByText("Meera Iyer's 11:00 appointment was updated.")).toBeAttached();

  await desk.getByRole('button', { name: 'Mark Meera Iyer as arrived' }).click();
  await expect(toast(desk, 'Meera Iyer marked as arrived')).toBeVisible();
  await expect(bookedSlotButton(watcher, '11:00')).toContainText('Arrived');
  await expect(watcher.getByText('Meera Iyer has arrived for 11:00.')).toBeAttached();

  // The details opened now show the new purpose.
  await bookedSlotButton(watcher, '11:00').click();
  const details = watcher.getByRole('dialog', { name: 'Appointment' });
  await expect(details).toContainText('Chest pain, second opinion');
  await watcher.keyboard.press('Escape');

  // Then they cancel it: the slot is free again.
  await desk.getByRole('button', { name: "Cancel Meera Iyer's appointment" }).click();
  await desk
    .getByRole('dialog', { name: 'Cancel this appointment?' })
    .getByRole('button', { name: 'Cancel appointment' })
    .click();
  await expect(toast(desk, 'Appointment cancelled for Meera Iyer')).toBeVisible();
  await expect(freeSlotLink(watcher, '11:00')).toBeVisible();
  await expect(
    watcher.getByText("Meera Iyer's 11:00 appointment was cancelled. The slot is free again."),
  ).toBeAttached();

  // All of it arrived over the socket: the page was never reloaded.
  await expect(marked).toBeAttached();
  const received = traffic.received.map(({ event }) => event);
  expect(received).toEqual(
    expect.arrayContaining(['appointment:created', 'appointment:updated', 'appointment:cancelled']),
  );
});

test("a window that moves to another day leaves the old day's room", async ({ page }) => {
  const { doctors, patients } = seedInfo();
  const traffic = recordSocketTraffic(page);
  await openAs(page, RECEPTIONIST, schedulerPath(doctors.kavya.id, DAY));
  await expectLive(page);

  await page.getByRole('button', { name: 'Next day' }).click();
  await expect(page).toHaveURL(new RegExp(`date=${NEXT_DAY}`));
  await expectLive(page);
  await expect
    .poll(() => eventsNamed(traffic.sent, 'scheduler:leave').map(({ data }) => data))
    .toContainEqual({ doctorId: doctors.kavya.id, date: DAY });
  await expect
    .poll(() => eventsNamed(traffic.sent, 'scheduler:join').map(({ data }) => data))
    .toContainEqual({ doctorId: doctors.kavya.id, date: NEXT_DAY });

  // A booking on the day it left doesn't reach it; one on the day it shows does.
  const heardBefore = traffic.received.length;
  const admin = await apiAs(ADMIN);
  const visit = { purpose: 'Reports review', patientId: patients.gita.id, slotStart: '11:30' };
  await book(admin, { ...visit, doctorId: doctors.kavya.id, date: DAY });
  await book(admin, { ...visit, doctorId: doctors.kavya.id, date: NEXT_DAY });
  await expect(bookedSlotButton(page, '11:30')).toContainText(PATIENTS.gita.name);
  const created = eventsNamed(traffic.received.slice(heardBefore), 'appointment:created');
  expect(created.map(({ data }) => (data as { date: string }).date)).toEqual([NEXT_DAY]);

  // Leaving the scheduler leaves its room too.
  await navLink(page, 'Appointments').click();
  await expect
    .poll(() => eventsNamed(traffic.sent, 'scheduler:leave').map(({ data }) => data))
    .toContainEqual({ doctorId: doctors.kavya.id, date: NEXT_DAY });
});
