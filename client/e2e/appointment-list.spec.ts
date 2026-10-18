import type { Page } from '@playwright/test';

import { appointmentQuery } from './support/api';
import {
  columnTexts,
  doctorNames,
  listPath,
  listRows,
  listSummary,
  openAs,
  patientNames,
  pickDate,
  screenshot,
  summaryText,
} from './support/app';
import { seedInfo } from './support/env';
import { apiAs, expect, signIn, test } from './support/fixtures';
import { LIST_SIZE } from './support/seed';
import { ADMIN, ARJUN, KAVYA, PATIENTS } from './support/seed-data';

// The list days hold 25 appointments: Dr. Mehta's 18 on the first, Dr. Rao's 7 on the second,
// in every status and across all eight patients. No other spec books on them.
const TOTAL = LIST_SIZE.kavya + LIST_SIZE.arjun;

const range = () => {
  const { listDays } = seedInfo();
  return { dateFrom: listDays.kavya, dateTo: listDays.arjun };
};

/** How many appointments the API holds for these filters within the list days. */
const totalFor = async (filters: Record<string, string>): Promise<number> => {
  const admin = await apiAs(ADMIN);
  return (await admin.page(appointmentQuery({ ...range(), ...filters, limit: 1 }))).total;
};

/** The query parameters of every GET /appointments the page sends from now on. */
const recordListRequests = (page: Page): URLSearchParams[] => {
  const requests: URLSearchParams[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() === 'GET' && url.pathname === '/api/v1/appointments') {
      requests.push(url.searchParams);
    }
  });
  return requests;
};

const isListRequest = (url: URL): boolean => url.pathname === '/api/v1/appointments';

test('pages through the appointments on the server', async ({ page }) => {
  const requests = recordListRequests(page);
  await openAs(page, ADMIN, listPath(range()));
  await expect(listSummary(page)).toHaveText(summaryText(TOTAL));
  await expect(listRows(page)).toHaveCount(20);

  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(listSummary(page)).toHaveText(summaryText(TOTAL, 2));
  await expect(listRows(page)).toHaveCount(TOTAL - 20);
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await page.getByLabel('Rows per page').selectOption('10');
  await expect(listSummary(page)).toHaveText(summaryText(TOTAL, 1, 10));
  const pageButtons = page
    .getByRole('navigation', { name: 'Pagination' })
    .getByRole('button', { name: /^Page \d+$/ });
  await expect(pageButtons).toHaveCount(Math.ceil(TOTAL / 10));

  // Each page was a request for just that page.
  const asked = requests.map((params) => `${params.get('page')}/${params.get('limit')}`);
  expect(asked).toEqual(expect.arrayContaining(['1/20', '2/20', '1/10']));
});

test('sorts on the server by the column chosen, both ways', async ({ page }) => {
  const requests = recordListRequests(page);
  await openAs(page, ADMIN, listPath(range()));
  await expect(listSummary(page)).toHaveText(summaryText(TOTAL));
  const patient = page.getByRole('columnheader', { name: 'Patient' });

  await patient.getByRole('button').click();
  await expect(patient).toHaveAttribute('aria-sort', 'ascending');
  await expect(page).toHaveURL(/sortBy=patientName/);
  await expect.poll(async () => (await patientNames(page))[0]).toBe(PATIENTS.asha.name);
  const ascending = await patientNames(page);
  expect(ascending).toEqual([...ascending].sort((a, b) => a.localeCompare(b)));

  await patient.getByRole('button').click();
  await expect(patient).toHaveAttribute('aria-sort', 'descending');
  await expect.poll(async () => (await patientNames(page))[0]).toBe(PATIENTS.tenzin.name);

  const doctor = page.getByRole('columnheader', { name: 'Doctor' });
  await doctor.getByRole('button').click();
  await expect(doctor).toHaveAttribute('aria-sort', 'ascending');
  await expect.poll(async () => (await doctorNames(page))[0]).toBe(ARJUN.name);
  await doctor.getByRole('button').click();
  await expect.poll(async () => (await doctorNames(page))[0]).toBe(KAVYA.name);

  const sorts = requests.map((params) => `${params.get('sortBy')} ${params.get('sortOrder')}`);
  expect(sorts).toEqual(
    expect.arrayContaining([
      'patientName asc',
      'patientName desc',
      'doctorName asc',
      'doctorName desc',
    ]),
  );
});

test('filters by status, patient, mobile, doctor, department and dates', async ({ page }) => {
  const { listDays } = seedInfo();
  await openAs(page, ADMIN, listPath(range()));
  await expect(listSummary(page)).toHaveText(summaryText(TOTAL));
  const reset = async () => {
    await page.goto(listPath(range()));
    await expect(listSummary(page)).toHaveText(summaryText(TOTAL));
  };

  await page.getByLabel('Status').selectOption('CANCELLED');
  await expect(listSummary(page)).toHaveText(summaryText(await totalFor({ status: 'CANCELLED' })));
  expect(new Set(await columnTexts(page, 'Status'))).toEqual(new Set(['Cancelled']));

  await reset();
  await page.getByLabel('Patient name').fill('Asha');
  await expect(page).toHaveURL(/patientName=Asha/);
  await expect(listSummary(page)).toHaveText(summaryText(await totalFor({ patientName: 'Asha' })));
  expect(new Set(await patientNames(page))).toEqual(new Set([PATIENTS.asha.name]));

  await reset();
  await page.getByLabel('Mobile', { exact: true }).fill('99887');
  await expect(page).toHaveURL(/mobile=99887/);
  await expect(listSummary(page)).toHaveText(summaryText(await totalFor({ mobile: '99887' })));
  expect(new Set(await patientNames(page))).toEqual(new Set([PATIENTS.meera.name]));

  await reset();
  await page.getByLabel('Doctor', { exact: true }).fill('arjun');
  await expect(listSummary(page)).toHaveText(summaryText(LIST_SIZE.arjun));
  expect(new Set(await doctorNames(page))).toEqual(new Set([ARJUN.name]));

  await reset();
  await page.getByLabel('Department', { exact: true }).selectOption({ label: 'Cardiology' });
  await expect(listSummary(page)).toHaveText(summaryText(LIST_SIZE.kavya));

  // Dates, through the calendar: only Dr. Rao's day.
  await page.goto(listPath());
  await pickDate(page, 'From', listDays.arjun);
  await pickDate(page, 'To', listDays.arjun);
  await expect(page).toHaveURL(new RegExp(`dateFrom=${listDays.arjun}&dateTo=${listDays.arjun}`));
  await expect(listSummary(page)).toHaveText(summaryText(LIST_SIZE.arjun));
});

test('text filters wait for a pause in typing before they search', async ({ page }) => {
  const requests = recordListRequests(page);
  await openAs(page, ADMIN, listPath(range()));
  await expect(listSummary(page)).toHaveText(summaryText(TOTAL));

  await page.getByLabel('Patient name').pressSequentially('Meera', { delay: 80 });
  await expect(page).toHaveURL(/patientName=Meera/);
  await expect(listSummary(page)).toHaveText(summaryText(await totalFor({ patientName: 'Meera' })));
  const searched = requests.flatMap((params) => params.getAll('patientName'));
  expect(searched).toEqual(['Meera']);
});

test('edits to two text filters within one pause are both applied', async ({ page }) => {
  await openAs(page, ADMIN, listPath(range()));
  await expect(listSummary(page)).toHaveText(summaryText(TOTAL));

  // Straight from one box to the next, faster than the pause that sends a search.
  await page.getByLabel('Patient name').fill('Asha');
  await page.getByLabel('Doctor', { exact: true }).fill('Kavya');
  await expect(page).toHaveURL(/patientName=Asha/);
  await expect(page).toHaveURL(/doctorName=Kavya/);
  const expected = await totalFor({ patientName: 'Asha', doctorName: 'Kavya' });
  await expect(listSummary(page)).toHaveText(summaryText(expected));
});

test('the address keeps the page, sort and filters, so a reload shows the same list', async ({
  page,
}) => {
  await openAs(page, ADMIN, listPath(range()));
  await page.getByLabel('Status').selectOption('SCHEDULED');
  await page.getByLabel('Doctor', { exact: true }).fill('Kavya');
  await expect(page).toHaveURL(/doctorName=Kavya/);
  await page.getByRole('columnheader', { name: 'Patient' }).getByRole('button').click();
  await page.getByLabel('Rows per page').selectOption('10');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/page=2/);
  const total = await totalFor({ status: 'SCHEDULED', doctorName: 'Kavya' });
  await expect(listSummary(page)).toHaveText(summaryText(total, 2, 10));
  const url = page.url();
  const names = await patientNames(page);

  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(listSummary(page)).toHaveText(summaryText(total, 2, 10));
  expect(await patientNames(page)).toEqual(names);
  await expect(page.getByLabel('Status')).toHaveValue('SCHEDULED');
  await expect(page.getByLabel('Doctor', { exact: true })).toHaveValue('Kavya');
  await expect(page.getByLabel('Rows per page')).toHaveValue('10');
  await expect(page.getByRole('columnheader', { name: 'Patient' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
});

test('shows a loading state, then the rows', async ({ page }, testInfo) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(isListRequest, async (route) => {
    await held;
    await route.continue();
  });
  await signIn(page.context(), ADMIN);
  await page.goto(listPath(range()));

  const table = page.getByRole('table', { name: 'Appointments' });
  await expect(table).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('status').filter({ hasText: 'Loading appointments' })).toBeAttached();
  await screenshot(page, testInfo, 'list-loading');

  release();
  await expect(listSummary(page)).toHaveText(summaryText(TOTAL));
  await expect(table).not.toHaveAttribute('aria-busy', 'true');
});

test('says when nothing matches, and clearing the filters clears the search boxes too', async ({
  page,
}, testInfo) => {
  await openAs(page, ADMIN, listPath(range()));
  await page.getByLabel('Patient name').fill('Zzyzx');
  const empty = page.getByRole('heading', { name: 'No appointments match these filters' });
  await expect(empty).toBeVisible();
  await screenshot(page, testInfo, 'list-empty');

  await page
    .getByRole('table', { name: 'Appointments' })
    .getByRole('button', { name: 'Clear filters' })
    .click();
  await expect(empty).toBeHidden();
  await expect(page).not.toHaveURL(/patientName|dateFrom/);
  await expect(page.getByLabel('Patient name')).toHaveValue('');
});

test('a search typed just before "Clear filters" does not come back', async ({ page }) => {
  await openAs(page, ADMIN, listPath());
  await expect(listRows(page).first()).toBeVisible();
  await page.getByLabel('Status').selectOption('ARRIVED');
  await expect(page).toHaveURL(/status=ARRIVED/);

  await page.getByLabel('Patient name').fill('Asha');
  await page
    .getByRole('region', { name: 'Filters' })
    .getByRole('button', { name: 'Clear filters' })
    .click();
  // Cleared before the pause that would have sent the search: past that pause, it stays gone.
  await page.waitForTimeout(800);
  await expect(page).not.toHaveURL(/patientName|status/);
  await expect(page.getByLabel('Patient name')).toHaveValue('');
});

test('shows an error with a way to try again', async ({ page, guard }, testInfo) => {
  guard.expectResponse(500, /\/api\/v1\/appointments\?/);
  await page.route(isListRequest, (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        message: 'Internal server error',
        data: null,
        meta: { requestId: 'e2e' },
      }),
    }),
  );
  await signIn(page.context(), ADMIN);
  await page.goto(listPath(range()));

  const failure = page.getByText("Couldn't load the appointments");
  await expect(failure).toBeVisible({ timeout: 15_000 });
  await screenshot(page, testInfo, 'list-error');

  await page.unroute(isListRequest);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(listSummary(page)).toHaveText(summaryText(TOTAL));
  await expect(failure).toBeHidden();
});
