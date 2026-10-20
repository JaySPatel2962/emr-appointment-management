import type { Page } from '@playwright/test';

import {
  logInWithForm,
  openAs,
  pageHeading,
  schedulerPath,
  screenshot,
  slotTiles,
  slotTimes,
  toast,
} from './support/app';
import { clinicToday, nextDateOn } from './support/dates';
import { seedInfo } from './support/env';
import { apiAs, expect, test } from './support/fixtures';
import { ADMIN, RECEPTIONIST } from './support/seed-data';

const PASSWORD = 'Welcome123';

/** One day of the schedule editor, found by its "works this day" checkbox. */
const dayRow = (page: Page, day: string) =>
  page
    .getByRole('list', { name: 'Working days' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('checkbox', { name: day, exact: true }) });

test.describe('Adding staff', () => {
  test('adds a receptionist, who can then log in', async ({ page, guard, openWindow }) => {
    guard.expectResponse(409, /\/api\/v1\/users\/receptionists$/);
    await openAs(page, ADMIN, '/admin?tab=receptionist');
    await expect(page.getByRole('tab', { name: 'Add a receptionist' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Checked as each field is left.
    await page.getByLabel('Full name').fill('Neha Joshi');
    await page.getByLabel('Email').fill('neha.joshi');
    await page.getByLabel('First password', { exact: true }).fill('short');
    await page.getByLabel('Full name').focus();
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('First password', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );

    // An email that another account uses is refused on its field.
    await page.getByLabel('Email').fill(RECEPTIONIST.email);
    await page.getByLabel('First password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Add receptionist' }).click();
    await expect(page.getByText('Another account already uses this email')).toBeVisible();

    const neha = { name: 'Neha Joshi', email: 'neha.joshi@clinic.example', password: PASSWORD };
    await page.getByLabel('Email').fill(neha.email);
    await page.getByRole('button', { name: 'Add receptionist' }).click();
    await expect(toast(page, 'Neha Joshi can now log in as a receptionist')).toBeVisible();
    await expect(page.getByLabel('Full name')).toHaveValue('');

    // Her account works straight away, with the receptionist's menu.
    const desk = await openWindow(neha);
    await desk.goto('/');
    await expect(pageHeading(desk, 'Today at the clinic')).toBeVisible();
    await expect(desk.getByRole('complementary').getByText(neha.name)).toBeVisible();
    await expect(desk.getByRole('link', { name: 'Staff and schedules' })).toHaveCount(0);
  });

  test('adds a doctor with their weekly schedule', async ({ page }, testInfo) => {
    await openAs(page, ADMIN, '/admin?tab=doctor');
    await page.getByRole('button', { name: 'Add doctor' }).click();
    await expect(page.getByLabel('Full name')).toBeFocused();
    await expect(page.getByLabel('Department')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Specialization')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Full name').fill('Dr. Sana Qureshi');
    await page.getByLabel('Email').fill('sana.qureshi@clinic.example');
    await page.getByLabel('First password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Department').selectOption({ label: 'Pediatrics' });
    await page.getByLabel('Specialization').fill('Neonatology');
    await page.getByLabel('Slot length').selectOption('20');
    await screenshot(page, testInfo, 'admin-add-doctor');
    await page.getByRole('button', { name: 'Add doctor' }).click();

    await expect(toast(page, 'Dr. Sana Qureshi added. They can now log in.')).toBeVisible();
    // Her schedule opens, under the list of doctors.
    await expect(page).toHaveURL(/tab=schedules&doctor=/);
    await expect(page.getByRole('heading', { name: "Dr. Sana Qureshi's schedule" })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Doctors' })).toContainText('Dr. Sana Qureshi');

    // The standard week she was given: Monday to Friday, 09:00 to 17:00, lunch at noon.
    const doctorId = new URL(page.url()).searchParams.get('doctor') ?? '';
    await page.goto(schedulerPath(doctorId, nextDateOn(clinicToday(), [1])));
    await expect(slotTiles(page).first()).toBeVisible();
    const times = await slotTimes(page);
    expect(times[0]).toBe('09:00');
    expect(times).not.toContain('12:00');
    expect(times.at(-1)).toBe('16:40');
  });
});

test.describe('Editing a schedule', () => {
  let doctorId = '';

  test.beforeAll(async () => {
    const { departments } = seedInfo();
    const admin = await apiAs(ADMIN);
    const created = await admin.post<{ id: string }>('/doctors', {
      name: 'Dr. Rohan Das',
      email: `rohan.das.${Date.now()}@clinic.example`,
      password: PASSWORD,
      departmentId: departments.Orthopedics,
      specialization: 'Sports injuries',
      slotDurationMinutes: 30,
      schedule: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
        dayOfWeek,
        sessions: [{ start: '09:00', end: '13:00' }],
        breaks: [],
      })),
    });
    doctorId = created.id;
  });

  test('refuses overlapping sessions, then saves a valid week', async ({ page }, testInfo) => {
    await openAs(page, ADMIN, `/admin?tab=schedules&doctor=${doctorId}`);
    await expect(page.getByRole('heading', { name: "Dr. Rohan Das's schedule" })).toBeVisible();
    const save = page.getByRole('button', { name: 'Save schedule' });
    await expect(save).toBeDisabled();

    // A second Monday session that overlaps the first.
    const monday = dayRow(page, 'Monday');
    await monday.getByRole('button', { name: 'Add a session' }).click();
    await page.getByLabel('Monday session 2 starts').fill('12:00');
    await page.getByLabel('Monday session 2 ends').fill('15:00');
    await save.click();
    await expect(monday.getByRole('alert')).toHaveText(
      'Sessions 09:00-13:00 and 12:00-15:00 overlap',
    );
    await screenshot(page, testInfo, 'admin-overlap');

    // A break outside working hours is refused too.
    await page.getByLabel('Monday session 2 starts').fill('14:00');
    await monday.getByRole('button', { name: 'Add a break' }).click();
    await page.getByLabel('Monday break 1 starts').fill('19:00');
    await page.getByLabel('Monday break 1 ends').fill('19:30');
    await save.click();
    await expect(monday.getByRole('alert')).toHaveText(
      'Break 19:00-19:30 must fall within working hours 09:00-15:00',
    );

    // Lunch between the sessions, and Saturday mornings too.
    await page.getByLabel('Monday break 1 starts').fill('13:00');
    await page.getByLabel('Monday break 1 ends').fill('14:00');
    const saturday = dayRow(page, 'Saturday');
    await saturday.getByRole('checkbox', { name: 'Saturday' }).check();
    await page.getByLabel('Saturday session 1 starts').fill('10:00');
    await page.getByLabel('Saturday session 1 ends').fill('12:00');
    await save.click();
    await expect(toast(page, 'Schedule saved for Dr. Rohan Das')).toBeVisible();
    await expect(save).toBeDisabled();

    // The scheduler offers the new hours.
    await page.goto(schedulerPath(doctorId, nextDateOn(clinicToday(), [6])));
    await expect(slotTiles(page).first()).toBeVisible();
    expect(await slotTimes(page)).toEqual(['10:00', '10:30', '11:00', '11:30']);
    await page.goto(schedulerPath(doctorId, nextDateOn(clinicToday(), [1])));
    await expect(slotTiles(page).first()).toBeVisible();
    const monday2 = await slotTimes(page);
    expect(monday2).toContain('14:00');
    expect(monday2).not.toContain('13:00');
    await expect(pageHeading(page, 'Scheduler')).toBeVisible();
  });
});

test('the admin page opens on the tab and doctor its address names', async ({ page }) => {
  const { doctors } = seedInfo();
  await openAs(page, ADMIN, `/admin?tab=schedules&doctor=${doctors.arjun.id}`);
  await expect(page.getByRole('heading', { name: "Dr. Arjun Rao's schedule" })).toBeVisible();
  await expect(page.getByRole('button', { name: "Edit Dr. Arjun Rao's schedule" })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Found in manual QA: the tab list overflowed by 1px, which shows a vertical scrollbar on
  // systems with classic scrollbars (Windows). It must not scroll vertically at all.
  const tabList = page.getByRole('tablist', { name: 'Staff and schedules' });
  expect(await tabList.evaluate((list) => list.scrollHeight - list.clientHeight)).toBe(0);

  await page.getByRole('tab', { name: 'Add a doctor' }).click();
  await expect(page).toHaveURL('/admin?tab=doctor');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Add a doctor' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('a new receptionist logs in with the password they were given', async ({ page }) => {
  const admin = await apiAs(ADMIN);
  const email = `arun.pillai.${Date.now()}@clinic.example`;
  await admin.post('/users/receptionists', { name: 'Arun Pillai', email, password: PASSWORD });

  await page.goto('/login');
  await logInWithForm(page, { name: 'Arun Pillai', email, password: PASSWORD });
  await expect(pageHeading(page, 'Today at the clinic')).toBeVisible();
  await expect(page.getByRole('complementary').getByText('Arun Pillai')).toBeVisible();
});
