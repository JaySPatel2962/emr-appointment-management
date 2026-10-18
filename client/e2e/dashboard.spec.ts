import type { Locator, Page } from '@playwright/test';

import { arrive, ensureBooked } from './support/api';
import { openAs, pageHeading } from './support/app';
import { clinicMinutes, clinicToday } from './support/dates';
import { seedInfo } from './support/env';
import { apiAs, expect, test } from './support/fixtures';
import { ADMIN, ARJUN, KAVYA, PATIENTS, RECEPTIONIST } from './support/seed-data';

// The dashboard is about today, so this spec books late this evening: one patient already
// waiting, one still to come. (No other spec books on today.)
const WAITING_AT = '23:00';
const NEXT_AT = '23:15';

/** A headline number, found by its label ("Waiting"). */
const statTile = (page: Page, label: string): Locator =>
  page.getByText(label, { exact: true }).locator('..');

test.describe('The dashboard', () => {
  test.skip(clinicMinutes() >= 22 * 60 + 45, "today's evening slots have started");

  test.beforeAll(async () => {
    const { doctors, patients } = seedInfo();
    const admin = await apiAs(ADMIN);
    const visit = { doctorId: doctors.kavya.id, date: clinicToday() };
    const waiting = await ensureBooked(admin, {
      ...visit,
      slotStart: WAITING_AT,
      purpose: 'Evening review',
      patientId: patients.imran.id,
    });
    if (waiting.status === 'SCHEDULED') {
      await arrive(admin, waiting.id);
    }
    await ensureBooked(admin, {
      ...visit,
      slotStart: NEXT_AT,
      purpose: 'Medication review',
      patientId: patients.meera.id,
    });
  });

  test('shows the front desk who is waiting and who is next', async ({ page }) => {
    await openAs(page, RECEPTIONIST, '/');
    await expect(pageHeading(page, 'Today at the clinic')).toBeVisible();
    await expect(statTile(page, 'Waiting')).toContainText('1');
    await expect(statTile(page, 'Still to come')).toContainText(`Next at ${NEXT_AT}`);

    const waiting = page.getByRole('region', { name: 'Waiting now' });
    const next = page.getByRole('region', { name: 'Up next' });
    await expect(waiting.getByRole('button')).toHaveText([
      new RegExp(`^${WAITING_AT}\\s*${PATIENTS.imran.name}`),
    ]);
    await expect(next.getByRole('button')).toHaveText([
      new RegExp(`^${NEXT_AT}\\s*${PATIENTS.meera.name}`),
    ]);

    await waiting.getByRole('button').click();
    await expect(page.getByRole('dialog', { name: 'Appointment' })).toContainText('Evening review');
  });

  test("shows a doctor their own day, and nobody else's", async ({ page }) => {
    await openAs(page, KAVYA, '/');
    await expect(pageHeading(page, 'Your day')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Waiting now' })).toContainText(
      PATIENTS.imran.name,
    );

    await page.getByRole('button', { name: 'Log out' }).click();
    await openAs(page, ARJUN, '/');
    await expect(pageHeading(page, 'Your day')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'No appointments with you today' }),
    ).toBeVisible();
    await expect(page.getByText(PATIENTS.imran.name)).toHaveCount(0);
  });

  test("shows a Super Admin each doctor's day", async ({ page }) => {
    await openAs(page, ADMIN, '/');
    const byDoctor = page.getByRole('table', { name: "Today's appointments by doctor" });
    await expect(byDoctor.getByRole('row', { name: new RegExp(KAVYA.name) })).toBeVisible();
    await expect(byDoctor.getByRole('row', { name: new RegExp(ARJUN.name) })).toBeVisible();
  });
});
