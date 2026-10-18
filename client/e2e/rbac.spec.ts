import { appointmentQuery } from './support/api';
import { listSummary, openAs, pageHeading, schedulerPath, summaryText } from './support/app';
import { seedInfo } from './support/env';
import { apiAs, expect, test } from './support/fixtures';
import { ADMIN, ARJUN, KAVYA, RECEPTIONIST } from './support/seed-data';
import type { Account } from './support/seed-data';

const MENUS: readonly { role: string; account: Account; links: string[] }[] = [
  {
    role: 'Super Admin',
    account: ADMIN,
    links: ['Dashboard', 'Scheduler', 'Book appointment', 'Appointments', 'Staff and schedules'],
  },
  {
    role: 'Receptionist',
    account: RECEPTIONIST,
    links: ['Dashboard', 'Scheduler', 'Book appointment', 'Appointments'],
  },
  { role: 'Doctor', account: KAVYA, links: ['Dashboard', 'Scheduler', 'Appointments'] },
];

const FORBIDDEN: readonly { role: string; account: Account; paths: string[] }[] = [
  { role: 'Receptionist', account: RECEPTIONIST, paths: ['/admin'] },
  { role: 'Doctor', account: KAVYA, paths: ['/appointments/new', '/admin?tab=doctor'] },
];

for (const { role, account, links } of MENUS) {
  test(`the ${role}'s menu offers only the pages they may use`, async ({ page }) => {
    await openAs(page, account, '/');
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(
      links,
    );
  });
}

for (const { role, account, paths } of FORBIDDEN) {
  test(`a ${role} who opens a page of another role sees "no access"`, async ({ page }) => {
    await openAs(page, account, '/');
    for (const path of paths) {
      await page.goto(path);
      await expect(pageHeading(page, "You don't have access to this page")).toBeVisible();
      await expect(page.getByText(`Your role (${role}) can't open this page.`)).toBeVisible();
      // The address still says what was asked for.
      await expect(page).toHaveURL(path);
      await expect(page).toHaveTitle(/^No access/);
    }
    await page.getByRole('link', { name: 'Go to the dashboard' }).click();
    await expect(page).toHaveURL('/');
  });
}

test('an address that leads nowhere shows "page not found"', async ({ page }) => {
  await openAs(page, RECEPTIONIST, '/reports/2026');
  await expect(pageHeading(page, 'Page not found')).toBeVisible();
  await expect(page.getByText('/reports/2026')).toBeVisible();
  await page.getByRole('link', { name: 'Go to the dashboard' }).click();
  await expect(pageHeading(page, 'Today at the clinic')).toBeVisible();
});

test('a doctor sees only their own appointments and their own day', async ({ page }) => {
  const { listDays, doctors } = seedInfo();
  const range = { dateFrom: listDays.kavya, dateTo: listDays.arjun };
  const admin = await apiAs(ADMIN);
  const everyone = await admin.page(appointmentQuery({ ...range, limit: 1 }));
  const his = await admin.page(
    appointmentQuery({ ...range, doctorId: doctors.arjun.id, limit: 1 }),
  );
  expect(his.total).toBeGreaterThan(0);
  expect(his.total).toBeLessThan(everyone.total);

  await openAs(page, ARJUN, `/appointments?dateFrom=${range.dateFrom}&dateTo=${range.dateTo}`);
  await expect(listSummary(page)).toHaveText(summaryText(his.total));
  // There is nobody else's to tell apart: no doctor column, no doctor or department filter.
  await expect(page.getByRole('columnheader', { name: 'Doctor' })).toHaveCount(0);
  await expect(page.getByLabel('Doctor', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Department', { exact: true })).toHaveCount(0);

  // An address asking for another doctor's day still shows his own.
  await page.goto(schedulerPath(doctors.kavya.id, listDays.arjun));
  await expect(page.getByRole('heading', { level: 2, name: ARJUN.name })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: KAVYA.name })).toHaveCount(0);
  await expect(page.getByLabel('Doctor', { exact: true })).toHaveCount(0);
});
