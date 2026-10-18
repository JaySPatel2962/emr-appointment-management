import type { Page } from '@playwright/test';

import { activeAppointments } from './support/api';
import { bookingPath, findPatient, openAs, pageHeading, slotOption, toast } from './support/app';
import { suiteDate } from './support/dates';
import { seedInfo } from './support/env';
import { apiAs, expect, test } from './support/fixtures';
import { ADMIN, PATIENTS, RECEPTIONIST } from './support/seed-data';

const DAY = suiteDate('doubleBooking');
const SLOT = '10:30';

/** Lets requests through only once `parties` of them are waiting, so they reach the API together. */
const createBarrier = (parties: number) => {
  let waiting = 0;
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return async (): Promise<void> => {
    waiting += 1;
    if (waiting >= parties) {
      open();
    }
    await opened;
  };
};

const outcomeOf = async (page: Page): Promise<'booked' | 'refused'> => {
  const booked = toast(page, /^Booked /);
  const refused = page.getByText(`Someone else booked ${SLOT} a moment ago. Choose another time.`);
  await expect(booked.or(refused)).toBeVisible();
  return (await booked.isVisible()) ? 'booked' : 'refused';
};

test('two people book the same slot at once: one gets it, the other is told and shown the change', async ({
  page,
  openWindow,
  guard,
}) => {
  guard.expectResponse(409, /\/api\/v1\/appointments$/);
  const { doctors } = seedInfo();
  const path = bookingPath(doctors.kavya.id, DAY, SLOT);

  const reception = page;
  await openAs(reception, RECEPTIONIST, path);
  const office = await openWindow(ADMIN);
  await office.goto(path);
  await expect(pageHeading(office, 'Book an appointment')).toBeVisible();

  await findPatient(reception, 'Asha', PATIENTS.asha.name);
  await reception.getByLabel('Purpose of the visit').fill('Follow-up after ECG');
  await findPatient(office, 'Ravi', PATIENTS.ravi.name);
  await office.getByLabel('Purpose of the visit').fill('Blood pressure review');

  const bothSent = createBarrier(2);
  for (const window of [reception, office]) {
    await window.route(
      (url) => url.pathname === '/api/v1/appointments',
      async (route) => {
        if (route.request().method() === 'POST') {
          await bothSent();
        }
        await route.continue();
      },
    );
  }
  await Promise.all(
    [reception, office].map((window) =>
      window.getByRole('button', { name: 'Book appointment' }).click(),
    ),
  );

  const outcomes = await Promise.all([outcomeOf(reception), outcomeOf(office)]);
  expect([...outcomes].sort()).toEqual(['booked', 'refused']);
  const loser = outcomes[0] === 'refused' ? reception : office;

  // The loser's slots were refreshed: the time is taken now and can't be chosen again.
  await expect(slotOption(loser, SLOT)).toBeDisabled();
  await expect(slotOption(loser, SLOT)).toHaveAccessibleName(/Booked/);
  await expect(loser).not.toHaveURL(/slot=/);
  // Nothing typed was lost: they only need another time.
  await expect(loser.getByLabel('Purpose of the visit')).not.toHaveValue('');
  await expect(loser.getByRole('button', { name: 'Change patient' })).toBeVisible();

  const booked = await activeAppointments(await apiAs(ADMIN), doctors.kavya.id, DAY);
  expect(booked.filter((appointment) => appointment.slotStart === SLOT)).toHaveLength(1);
});
