import {
  bookedSlotButton,
  bookingPath,
  chooseOption,
  choosePatientMode,
  findPatient,
  openAs,
  pageHeading,
  screenshot,
  toast,
} from './support/app';
import { addDays, clinicToday, suiteDate } from './support/dates';
import { seedInfo } from './support/env';
import { apiAs, expect, test } from './support/fixtures';
import { PATIENTS, RECEPTIONIST } from './support/seed-data';

const DAY = suiteDate('booking');

test('finds a registered patient by patient ID, mobile number or name', async ({ page }) => {
  const { doctors, patients } = seedInfo();
  await openAs(page, RECEPTIONIST, bookingPath(doctors.kavya.id, DAY, '10:00'));
  const search = page.getByLabel('Find the patient');
  const matches = page.getByRole('group', { name: 'Matching patients' }).getByRole('radio');

  for (const [term, name] of [
    [patients.meera.code, PATIENTS.meera.name],
    ['98765', PATIENTS.asha.name],
    ['imr', PATIENTS.imran.name],
  ] as const) {
    await search.fill(term);
    await expect(matches).toHaveCount(1);
    await expect(matches.first()).toHaveAccessibleName(new RegExp(name));
  }
});

test('the patient search waits for a pause in typing', async ({ page }) => {
  const { doctors } = seedInfo();
  const searched: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/v1/patients') {
      searched.push(url.searchParams.get('search') ?? '');
    }
  });
  await openAs(page, RECEPTIONIST, bookingPath(doctors.kavya.id, DAY, '10:00'));

  await page.getByLabel('Find the patient').pressSequentially('Lakshmi', { delay: 60 });
  await expect(page.getByRole('radio', { name: new RegExp(PATIENTS.lakshmi.name) })).toBeVisible();
  expect(searched).toEqual(['Lakshmi']);
});

test('books a registered patient, confirms it, and shows the slot as booked', async ({
  page,
}, testInfo) => {
  const { doctors } = seedInfo();
  await openAs(page, RECEPTIONIST, bookingPath(doctors.kavya.id, DAY, '10:00'));
  await findPatient(page, 'Imr', PATIENTS.imran.name);
  await expect(page.getByRole('button', { name: 'Change patient' })).toBeVisible();
  await page.getByLabel('Purpose of the visit').fill('Skin allergy consultation');
  await screenshot(page, testInfo, 'booking-filled');
  await page.getByRole('button', { name: 'Book appointment' }).click();

  await expect(
    toast(page, /^Booked Imran Khan with Dr\. Kavya Mehta on .+ at 10:00$/),
  ).toBeVisible();
  await expect(page).toHaveURL(`/scheduler?doctor=${doctors.kavya.id}&date=${DAY}`);
  await expect(bookedSlotButton(page, '10:00')).toContainText(PATIENTS.imran.name);
});

test('says what is missing or wrong, and sends nothing until it is right', async ({
  page,
}, testInfo) => {
  const { doctors } = seedInfo();
  let bookings = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/appointments') {
      bookings += 1;
    }
  });
  await openAs(page, RECEPTIONIST, bookingPath(doctors.kavya.id, DAY));
  const submit = page.getByRole('button', { name: 'Book appointment' });

  await submit.click();
  await expect(page.getByText('Choose a time', { exact: true })).toBeVisible();
  await expect(page.getByText('Choose a patient, or register a new one')).toBeVisible();
  await expect(page.getByText('Enter the purpose of the visit')).toBeVisible();

  await choosePatientMode(page, 'New patient');
  await page.getByLabel('Mobile number').fill('12345');
  await page.getByLabel('Date of birth').fill(addDays(clinicToday(), 1));
  await submit.click();
  await expect(page.getByText("Enter the patient's name")).toBeVisible();
  await expect(
    page.getByText('Enter a 10-digit Indian mobile number, such as 98765 43210'),
  ).toBeVisible();
  await expect(page.getByText('Choose a gender')).toBeVisible();
  await expect(page.getByText("The date of birth can't be in the future")).toBeVisible();
  await screenshot(page, testInfo, 'booking-errors');
  expect(bookings).toBe(0);
});

test('registers a new patient with their first booking', async ({ page }) => {
  const { doctors } = seedInfo();
  await openAs(page, RECEPTIONIST, bookingPath(doctors.kavya.id, DAY, '10:15'));
  await choosePatientMode(page, 'New patient');
  await page.getByLabel('Full name').fill('Kiran Desai');
  await page.getByLabel('Mobile number').fill('+91 90000 12345');
  await page.getByLabel('Date of birth').fill('1988-07-01');
  await chooseOption(page, 'Gender', 'Male');
  await page.getByLabel('Purpose of the visit').fill('First consultation');
  await page.getByRole('button', { name: 'Book appointment' }).click();

  await expect(toast(page, /^Booked Kiran Desai with Dr\. Kavya Mehta/)).toBeVisible();
  await expect(bookedSlotButton(page, '10:15')).toContainText('Kiran Desai');

  // The patient is on record now, with the mobile number in its 10-digit form.
  const api = await apiAs(RECEPTIONIST);
  const found = await api.page<{ name: string; mobile: string; patientCode: string }>(
    '/patients?search=Kiran',
  );
  expect(found.items).toEqual([
    expect.objectContaining({ name: 'Kiran Desai', mobile: '9000012345' }),
  ]);
});

test('a search without a match offers to register that patient', async ({ page }) => {
  const { doctors } = seedInfo();
  await openAs(page, RECEPTIONIST, bookingPath(doctors.kavya.id, DAY, '10:30'));
  await page.getByLabel('Find the patient').fill('Zara Ali');
  await expect(page.getByText('No registered patient matches “Zara Ali”.')).toBeVisible();

  await page.getByRole('button', { name: 'Register a new patient' }).click();
  await expect(page.getByRole('radio', { name: 'New patient' })).toBeChecked();
  await expect(page.getByLabel('Full name')).toHaveValue('Zara Ali');
  await expect(pageHeading(page, 'Book an appointment')).toBeVisible();
});

// Found in manual QA (Q-02): nothing said that the mobile number was already registered.
test('a registered mobile number asks "Is it one of these?" and switches to that patient', async ({
  page,
}) => {
  const { doctors } = seedInfo();
  await openAs(page, RECEPTIONIST, bookingPath(doctors.kavya.id, DAY));
  await choosePatientMode(page, 'New patient');
  const hint = page.getByRole('status').filter({ hasText: 'Is it one of these?' });

  await page.getByLabel('Mobile number').fill(`+91 ${PATIENTS.asha.mobile}`);
  await expect(hint).toContainText('A registered patient has this mobile number.');

  await hint.getByRole('button', { name: `Choose ${PATIENTS.asha.name}` }).click();

  const existing = page.getByRole('radio', { name: 'Existing patient' });
  await expect(existing).toBeChecked();
  await expect(existing).toBeFocused();
  await expect(page.getByRole('button', { name: 'Change patient' })).toBeVisible();
  await expect(page.getByText(PATIENTS.asha.name, { exact: true })).toBeVisible();
});
