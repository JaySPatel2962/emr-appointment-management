import { appointmentQuery, arrive, cancel, ensureBooked } from './support/api';
import type { ApiAppointment } from './support/api';
import {
  bookedSlotButton,
  findPatient,
  freeSlotLink,
  listPath,
  listRow,
  openAs,
  schedulerPath,
  screenshot,
  statusOf,
  toast,
} from './support/app';
import { suiteDate } from './support/dates';
import { seedInfo } from './support/env';
import { apiAs, expect, test } from './support/fixtures';
import { ADMIN, KAVYA, PATIENTS, RECEPTIONIST } from './support/seed-data';
import type { PatientKey } from './support/seed-data';

const DAY = suiteDate('actions');
const dayList = () => listPath({ dateFrom: DAY, dateTo: DAY });

// One appointment per test, so each test starts from a SCHEDULED visit of its own.
const VISITS = [
  ['asha', '09:00', 'Follow-up after ECG'],
  ['ravi', '09:15', 'Blood pressure review'],
  ['meera', '09:30', 'Chest pain review'],
  ['imran', '09:45', 'Medication review'],
  ['lakshmi', '10:00', 'Annual check-up'],
  ['farhan', '10:15', 'Reports review'],
  ['tenzin', '10:30', 'Annual check-up'],
] as const satisfies readonly (readonly [PatientKey, string, string])[];

const booked = new Map<PatientKey, ApiAppointment>();
const visitOf = (patient: PatientKey): ApiAppointment => {
  const appointment = booked.get(patient);
  if (!appointment) {
    throw new Error(`No appointment was booked for ${patient}`);
  }
  return appointment;
};

test.beforeAll(async () => {
  const { doctors, patients } = seedInfo();
  const admin = await apiAs(ADMIN);
  for (const [patient, slotStart, purpose] of VISITS) {
    booked.set(
      patient,
      await ensureBooked(admin, {
        doctorId: doctors.kavya.id,
        date: DAY,
        slotStart,
        purpose,
        patientId: patients[patient].id,
      }),
    );
  }
});

test('edits the purpose and notes of a visit', async ({ page }, testInfo) => {
  await openAs(page, RECEPTIONIST, dayList());
  await page.getByRole('button', { name: "Edit Asha Rao's appointment" }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit appointment' });
  const purpose = dialog.getByLabel('Purpose of the visit');

  await purpose.fill('');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByText('Enter the purpose of the visit')).toBeVisible();

  await purpose.fill('ECG follow-up, bring the reports');
  await dialog.getByLabel('Notes').fill('Prefers morning slots.');
  await screenshot(page, testInfo, 'edit-dialog');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Changes saved')).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(listRow(page, PATIENTS.asha.name)).toContainText('ECG follow-up, bring the reports');

  await page.getByRole('button', { name: PATIENTS.asha.name, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Appointment' })).toContainText(
    'Prefers morning slots.',
  );
});

test('checks a patient in', async ({ page }) => {
  await openAs(page, RECEPTIONIST, dayList());
  const row = listRow(page, PATIENTS.ravi.name);
  await row.getByRole('button', { name: 'Mark Ravi Kumar as arrived' }).click();

  await expect(toast(page, 'Ravi Kumar marked as arrived')).toBeVisible();
  await expect(statusOf(row)).toHaveText('Arrived');
  await expect(row.getByRole('button', { name: 'Mark Ravi Kumar as arrived' })).toHaveCount(0);
  // Only a doctor (or a Super Admin) completes a visit.
  await expect(row.getByRole('button', { name: "Complete Ravi Kumar's visit" })).toHaveCount(0);
});

test('cancels a visit only after confirming', async ({ page }, testInfo) => {
  await openAs(page, RECEPTIONIST, dayList());
  const row = listRow(page, PATIENTS.meera.name);
  const cancelButton = row.getByRole('button', { name: "Cancel Meera Iyer's appointment" });
  const confirm = page.getByRole('dialog', { name: 'Cancel this appointment?' });

  await cancelButton.click();
  await expect(confirm).toContainText("Meera Iyer's appointment with Dr. Kavya Mehta");
  await screenshot(page, testInfo, 'cancel-dialog');
  await confirm.getByRole('button', { name: 'Keep appointment' }).click();
  await expect(confirm).toBeHidden();
  await expect(statusOf(row)).toHaveText('Scheduled');

  await cancelButton.click();
  await confirm.getByRole('button', { name: 'Cancel appointment' }).click();
  await expect(toast(page, 'Appointment cancelled for Meera Iyer')).toBeVisible();
  await expect(statusOf(row)).toHaveText('Cancelled');
  await expect(row.getByRole('button', { name: /arrived|^Edit|^Cancel/ })).toHaveCount(0);
});

test('an action someone else got to first is refused with a clear message', async ({
  page,
  guard,
}) => {
  guard.expectResponse(409, /\/api\/v1\/appointments\/[a-f\d]+\/arrive$/);
  await openAs(page, RECEPTIONIST, dayList());
  const row = listRow(page, PATIENTS.imran.name);
  const arrived = row.getByRole('button', { name: 'Mark Imran Khan as arrived' });
  await expect(arrived).toBeVisible();

  // Meanwhile, at another desk, the visit is cancelled.
  await cancel(await apiAs(ADMIN), visitOf('imran').id);
  await arrived.click();

  await expect(
    toast(page, 'This appointment is cancelled and cannot be marked as arrived'),
  ).toBeVisible();
  // The list fetched the truth: the visit shows as cancelled, with nothing left to do.
  await expect(statusOf(row)).toHaveText('Cancelled');
  await expect(arrived).toHaveCount(0);
});

test('a cancelled slot can be booked again', async ({ page }) => {
  const { doctors } = seedInfo();
  const admin = await apiAs(ADMIN);
  await cancel(admin, visitOf('farhan').id);

  await openAs(page, RECEPTIONIST, schedulerPath(doctors.kavya.id, DAY));
  await freeSlotLink(page, '10:15').click();
  await findPatient(page, 'Gita', PATIENTS.gita.name);
  await page.getByLabel('Purpose of the visit').fill('Reports review');
  await page.getByRole('button', { name: 'Book appointment' }).click();
  await expect(toast(page, /^Booked Gita Sharma/)).toBeVisible();
  await expect(bookedSlotButton(page, '10:15')).toContainText(PATIENTS.gita.name);

  // Both stay on record: the cancelled visit and the new booking.
  const { items } = await admin.page<ApiAppointment>(
    appointmentQuery({ doctorId: doctors.kavya.id, dateFrom: DAY, dateTo: DAY, limit: 100 }),
  );
  const atTheSlot = items.filter((appointment) => appointment.slotStart === '10:15');
  expect(atTheSlot.map(({ status }) => status).sort()).toEqual(['CANCELLED', 'SCHEDULED']);
});

test('a doctor completes a visit and writes notes, and can do nothing else', async ({ page }) => {
  await arrive(await apiAs(ADMIN), visitOf('lakshmi').id);
  await openAs(page, KAVYA, dayList());

  const lakshmi = listRow(page, PATIENTS.lakshmi.name);
  await lakshmi.getByRole('button', { name: "Complete Lakshmi Menon's visit" }).click();
  await expect(toast(page, 'Visit completed for Lakshmi Menon')).toBeVisible();
  await expect(statusOf(lakshmi)).toHaveText('Completed');

  const tenzin = listRow(page, PATIENTS.tenzin.name);
  await expect(tenzin.getByRole('button', { name: /arrived|^Cancel/ })).toHaveCount(0);
  await tenzin.getByRole('button', { name: "Edit Tenzin Dorje's appointment" }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit appointment' });
  // The purpose is the front desk's: a doctor reads it but writes only the notes.
  await expect(dialog.getByLabel('Purpose of the visit')).toHaveCount(0);
  await expect(dialog.getByText('Annual check-up')).toBeVisible();
  await dialog.getByLabel('Notes').fill('BP 130/85. Review in three months.');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(toast(page, 'Changes saved')).toBeVisible();
});
