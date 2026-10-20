# Manual end-to-end test report

An independent, manual QA pass over the EMR appointment module, against every requirement in [`ASSESSMENT.md`](ASSESSMENT.md). The point was to use the real app the way clinic staff would, over several days of bookings, and to try to break it. The existing Playwright suite was not used for this.

- **When:**
  - Monday 19 October 2026 from 01:40 IST: Groups A to I.
  - Tuesday 20 October: the fixes, their retests and the final runs.
  - Tuesday 20 October, 15:06 to about 16:45 IST: the [R2 retest](#r2-retest-after-the-q-01-to-q-07-changes) of the changes made for the open questions.

  The scenarios with dates book across the following two weeks.
- **App:** the API (`src/server.ts` through tsx, `NODE_ENV=development` as in `server/.env`) on `localhost:5000`. The client is a production build (`npm run build`, served by `vite preview`) on `localhost:5173`.
- **Database:** the Atlas cluster from `server/.env`, in the database **`emr_manual_qa`**. Only the database name was changed, in memory, when each process started. No other database was read or written; the cluster's database names were listed once, before the first write. The test data is left in place.
- **Browser:** Chromium 1.64 (Playwright), visible (`headless: false`, `slowMo` 250 ms for the UI groups, less for the measuring scripts), en-IN, timezone Asia/Kolkata unless a scenario says otherwise. It was driven by throwaway scripts in `qa/` (gitignored). Their output is quoted in the Actual column.
- **Accounts:** the Super Admin came from the seed script. Every other account was created through the UI. The logins are in `qa-credentials.local.md` (gitignored).
- **Settings changed for the run:** `RATE_LIMIT_MAX=100000`, because the volume scripts all come from 127.0.0.1 and the default (300 requests per 15 minutes) would stop them. The default was tested on its own in Group F. Any other temporary change is named in its scenario.

## Summary

- **Scenarios:**
  - First pass: 316 scripted scenarios (each a step with an expected result and a recorded outcome), plus about 10 ad-hoc reruns.
  - R2 retest: 137 scripted checks. On their final runs, 136 pass and 1 is INFO (patient-code gaps). The first runs had 5 failures caused by mistakes in my scripts (test data, an expectation, a locator), each rerun once corrected, and found the 3 new bugs below.

  They are grouped below as rows; a row can hold several checks, for example G-03's 25 filters.
- **Every requirement in `ASSESSMENT.md` was exercised:** authentication, RBAC, schedules, slots, the scheduler, booking, concurrency, the lifecycle, search with paging, the audit trail, real time, security, the database and the frontend's states. Each holds as specified, apart from the items under [Bugs](#bugs) and [Open questions](#open-questions).
- **Bugs:** 12 found, **all fixed**: 9 in the first pass and 3 in the R2 retest (BUG-10 to BUG-12). Each has its own `fix:` commit, a regression test that fails without the fix, and a retest against the running app. The most serious:
  - any website could sign staff out (BUG-06)
  - a long patient name pushed the list's Arrived and Cancel buttons out of view at 1280 px (BUG-04)
  - an anonymous nested-JSON body produced a 500 (BUG-05)
  - offline, the app paused silently, and a booking would have sent itself later (BUG-09)
  - at 768 px the appointment list had no sort control at all (BUG-12)
- **Open questions:**
  - Q-01 to Q-07: **4 resolved** by changes (Q-02, Q-03, Q-06, Q-07) and **3 kept**, documented in the README's Assumptions and Known limitations (Q-01, Q-04, Q-05). Q-07, a doctor booked twice for the same time after a schedule edit, can no longer happen: R2-01 found 0 overlaps.
  - The R2 retest raised **2 more**. Q-08 (two admins saving one schedule at once) is resolved by a version check on schedule saves, retested in [R3](#r3-retest-of-the-q-08-change-and-the-booking-race). Q-09 (filtered searches sort in memory) is kept: a search sorts a few dozen matches at most.
- **Not tested:** listed at the [end](#not-tested).
- **Final runs after all fixes:** see [Final regression runs](#final-regression-runs).

**How to read the tables.** Result is PASS, FAIL (a bug, listed under [Bugs](#bugs)), INFO (behavior recorded without a pass/fail expectation) or QUESTION (ambiguous against the assessment, listed under [Open questions](#open-questions)). Evidence gives database ids or counts, read with read-only queries, and the screenshot. Ten key screenshots are kept in [`docs/manual-qa/`](manual-qa/) (see [Screenshots](#screenshots)). The others named in the tables were taken during the run and are kept outside git, in the gitignored `qa/manual-qa-archive/` and `qa/shots-r2/`.

## Step 0: Pre-checks

| ID | Check | Result | Evidence |
| --- | --- | --- | --- |
| P-01 | Untracked root `package.json` and `package-lock.json` | INFO | They hold only `devDependencies: { typescript: ^7.0.2 }`, with no name and no scripts. They were created 18 Oct 15:12 and never committed, and there is no root `node_modules`. No README command, script or config uses them, so they were left uncommitted. They look like an accidental `npm i -D typescript` at the repo root (both packages pin TypeScript 6.0). Deleting them is safe. |
| P-02 | The QA database is new and isolated | PASS | Before the first write, the cluster held `emr_appointments`, `admin` and `local`; `emr_manual_qa` did not exist. The API log says `MongoDB connected, database: "emr_manual_qa"`, and neither the API log nor the seed log contains a `mongodb://` or `mongodb+srv://` string. |
| P-03 | Every documented index exists (`listIndexes`) | PASS | 19 of 19, as in DATABASE_DESIGN.md §5. They include `appointments.uniq_active_doctor_slot` (unique, partial on `status $in [SCHEDULED, ARRIVED, COMPLETED]`), the TTL index `refresh_tokens.expiresAt_1` (`expireAfterSeconds: 0`) and `departments.name_1` (unique, collation en/2). There are no extra indexes. |
| P-04 | Clinic time | INFO | 01:39 IST, Monday 19 Oct. Every normal slot today (09:00 onward) was still ahead, so Doctor 3 was given a night session that starts 30 minutes after the doctor was created (02:20). That lets same-day booking and the PAST rule be tested during the run. |
| P-05 | Seed: only the Super Admin and departments | PASS | `npm run seed` created the 5 default departments and the QA Super Admin. Users: 1, appointments: 0, patients: 0. |

## Group A: Admin setup (through the UI)

Doctors created (ids are `doctors._id`):

| Doctor | Department | Slots | Week |
| --- | --- | --- | --- |
| Dr. Meera Iyer (`6ad52a005099159b77ebd80a`) | General Medicine | 15 min | Mon-Sat, 09:00-12:00 and 13:00-17:00, lunch break 12:00-13:00 |
| Dr. Farhan Qureshi (`6ad52a0d5099159b77ebd80e`) | Dermatology | 30 min | Mon, Wed, Fri, 10:00-14:00 with a break 12:15-12:45 inside it, and 16:00-18:00 |
| Dr. Nisha Verma (`6ad52a255099159b77ebd812`) | Cardiology | 20 min | Every day, 02:20-04:35 (6 slots and 15 minutes left over), and 19:00-23:50 with a break 21:10-21:25 (off the 20-minute grid) |
| Dr. Leave Cover (`6ad52a8b5099159b77ebd832`) | Orthopedics | 15 min | No working days (scenario A-15) |

| ID | Scenario and steps | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| A-01 | Super Admin logs in through the login form | Dashboard | "Today at the clinic" | PASS | `A-01-admin-dashboard.png` |
| A-02 | Add a doctor: Doctor 1, built in the schedule editor (standard week, plus Saturday added by hand) | 201, schedule saved as entered | 201; days 1-6, 15 min; toast "Dr. Meera Iyer added. They can now log in." and the editor opens on the new doctor | PASS | `doctors._id 6ad52a005099159b77ebd80a`; `A-02-doctor1-created.png` |
| A-03 | Add a doctor: Doctor 2 (Mon/Wed/Fri, 30 min, a break inside a session) | 201 | 201; days 1, 3, 5 | PASS | `6ad52a0d5099159b77ebd80e`; `A-03-doctor2-created.png` |
| A-04 | Add a doctor: Doctor 3 (every day, night session from created time + 30 min, a slot length that doesn't divide the session) | 201 | 201 at 01:50 IST; night session 02:20-04:35. The UI offers no 25-minute slot (see A-13), so 20 minutes over a 135-minute session was used. | PASS | `6ad52a255099159b77ebd812`; `A-04-doctor3-created.png` |
| A-05 | The doctor directory lists every doctor with department, slot length and working days | All three | "Dr. Farhan Qureshi … 30 minutes Mon, Wed, Fri", "Dr. Meera Iyer … 15 minutes Mon, Tue, Wed, Thu, Fri, Sat", "Dr. Nisha Verma … 20 minutes Mon … Sun" | PASS; BUG-01 found here (fixed) | `A-05-doctor-directory.png` |
| A-06 | Add three receptionists: Anita Desai, Rahul Menon, Vikram Sethi | 201; no secrets in the response | 201 each; the response fields are `id, name, email, role` only | PASS | users `6ad52a295099159b77ebd816`, `6ad52a2b5099159b77ebd819`, `6ad52a2d5099159b77ebd81c` |
| A-07 | Invalid schedule in the UI: Monday sessions 09:00-12:00 and 11:00-14:00 | Inline error, no request | "Sessions 09:00-12:00 and 11:00-14:00 overlap" on the second session; no POST was sent | PASS | `A-07.png` |
| A-08 | A break 18:00-18:30 on a 09:00-17:00 day | Inline error | "Break 18:00-18:30 must fall within working hours 09:00-17:00"; no POST | PASS | `A-08.png` |
| A-09 | A break 16:30-17:30 that runs past the session end | Inline error | "Break 16:30-17:30 must fall within working hours 09:00-17:00"; no POST | PASS | `A-09.png` |
| A-10 | A session 12:00-09:00 (start after end) | Inline error | "Start 12:00 must be before end 09:00"; no POST | PASS | `A-10.png` |
| A-11 | A session 09:00-09:00 (start equal to end) | Inline error | "Start 09:00 must be before end 09:00"; no POST | PASS | `A-11.png` |
| A-12 | Breaks 12:00-13:00 and 12:30-13:30 | Inline error | "Breaks 12:00-13:00 and 12:30-13:30 overlap"; no POST | PASS | `A-12.png` |
| A-13 | A slot length of 0 or less in the UI | Impossible | The slot length is a select with 5, 10, 15, 20, 30, 45 and 60 minutes, so 0 or a negative value can't be entered. Neither can 25, which the API accepts (5 to 240). | PASS (INFO: 25 is not offered) | |
| A-14 | The same rules through the API, bypassing the UI (`POST /doctors`) | 400 with the field path | 400 for each case, with the exact field. Overlapping sessions: `body.schedule.0.sessions.1`. Break outside working hours: `body.schedule.0.breaks.0`. Start after end: `body.schedule.0.sessions.0`. Slot length 0 and -15: "Too small: expected number to be >=5". 7.5: "expected int". 241: "Too big … <=240". A day listed twice: "Day 1 is listed more than once". A working day without sessions: "A working day needs at least one session". `dayOfWeek` 7: "<=6". `24:00`: "Must be a time in HH:mm format". | PASS | The requests were well-formed apart from the rule under test; nothing was saved |
| A-15 | A doctor with every day switched off (no working days) | The brief says this must be rejected | **Accepted.** The UI gives no warning, and the API answers 201 with `schedule: []`, the documented default. The doctor then has no slots on any day. | QUESTION Q-01 | `6ad52a8b5099159b77ebd832`; `A-15-no-working-days.png` |
| A-16 | Add a receptionist with an existing email in capitals (`ANITA.DESAI@…`) | Refused, on the email field | 409; the email field shows "Another account already uses this email" | PASS | `A-16-duplicate-email.png` |
| A-17 | Add a doctor with a receptionist's email | Refused; nothing saved | 409, the same message on the email field; 0 doctor profiles saved for "Dr. Duplicate" (the account and profile are one transaction) | PASS | `doctors.countDocuments({ name: 'Dr. Duplicate' }) = 0` |
| A-18 | Weak passwords, in the UI and through the API: `password`, `12345678`, `abc123`, and 73 characters | Refused | UI: "Include at least one number", "Include at least one letter", "Use at least 8 characters". API: 400 "Must contain a number", "Must contain a letter", "Must be at least 8 characters", "Must be at most 72 characters" | PASS | |
| A-19 | An inactive user can't log in. Vikram Sethi was deactivated directly in `emr_manual_qa` (`isActive: false`), because no endpoint or screen deactivates users | Refused, with the same message as a wrong password | UI and API both answer 401 "Invalid email or password", identical to a wrong password or an unknown email apart from the request id. The audit log records the real reasons: `ACCOUNT_DISABLED` and `WRONG_PASSWORD`. | PASS | `users 6ad52a2d5099159b77ebd81c isActive=false`; `A-19-inactive-login.png` |
| A-20 | Edit a schedule after appointments exist | See below | Run after Group B, which creates the appointments | See [A-20](#a-20-schedule-edits-with-booked-appointments) | |

Database after Group A: 8 users (1 Super Admin, 4 doctors, 3 receptionists, 1 of them inactive), 4 doctor profiles, 0 appointments, 0 patients. All password hashes are bcrypt with cost 12 (`$2b$12$`).

## Group B: A receptionist's day

Twenty bookings went through the UI: Anita Desai made 16 and Rahul Menon 4. Each started on the scheduler's free tile and went through the booking form. Another 52 went through the API with the receptionists' tokens: 50 volume bookings and 2 boundary checks. Database after Group B: **72 appointments** over 10 dates and 3 doctors (Dr. Meera Iyer 35, Dr. Farhan Qureshi 18, Dr. Nisha Verma 19), created by Anita Desai (42) and Rahul Menon (30), and **24 patients**, PAT-000001 to PAT-000024.

### Patient search

Run in the booking form's "Find the patient" box, and through `GET /patients?search=` for exact totals. Patients searched: Asha Rao (PAT-000001, 9876543210), Arjun Rao (PAT-000013, the same mobile), Sunita Patil (9876511111) and others.

| ID | Search | Expected | Actual (UI and API) | Result |
| --- | --- | --- | --- | --- |
| B-S-01 | Patient ID `PAT-000001` | Asha Rao | "1 patient matches. Asha Rao"; API total 1 | PASS |
| B-S-02 | Patient ID in lower case `pat-000001` | Asha Rao | The same | PASS |
| B-S-03 | `PAT-1` (no zero padding) | | No match. Patient IDs match exactly. | INFO |
| B-S-04 | Full mobile `9876543210` | Asha and Arjun Rao | "2 patients match"; API total 2 | PASS |
| B-S-05 | Full mobile as `+91 98765 43210` | The same | The same | PASS |
| B-S-06 | Partial mobile `98765` | Arjun Rao, Asha Rao, Sunita Patil | The same 3 | PASS |
| B-S-07 | Mobile digits from the middle, `43210` | | No match. Mobile search is a prefix match (documented). | INFO |
| B-S-08 | Full name `Asha Rao` | Asha Rao | 1 match | PASS |
| B-S-09 | Partial name `Ash` | Asha Rao | 1 match | PASS |
| B-S-10 | Surname only, `Rao` | | **No match.** Name search matches only the start of the full name, so neither Asha Rao nor Arjun Rao is found by surname (documented in API.md). | QUESTION Q-03 |
| B-S-11 | Different case, `aSHA RAO` | Asha Rao | 1 match | PASS |
| B-S-12 | No result, `Zzyzx` | "No match" and a way to register | "No registered patient matches “Zzyzx”." and "Register a new patient" | PASS |
| B-S-13 | Devanagari `श्रीमती` | श्रीमती आशा राव | 1 match | PASS |
| B-S-14 | `josé` | José Álvarez | 1 match | PASS |
| B-S-15 | `jose` (no accent) | | No match: accents are not folded | INFO |
| B-S-16 | `<scr` | The patient named `<script>alert('xss')</script>`, shown as text | 1 match, rendered as text | PASS |
| B-S-17 | `.*` | No match, and no error | No match (input is escaped before it becomes a regex) | PASS |
| B-S-18 | `--` (separators only) | No match | **All 14 patients registered at that point**: "Showing 8 of 14 matches". The term is read as a mobile number, the separators are stripped, and the empty prefix matches everyone. | FAIL → fixed, BUG-02 |
| B-S-19 | One character, `A` | No search yet (starts at 2) | No request is sent, but **8 results stay on screen from the previous search** (`--`) and can still be picked | FAIL → fixed, BUG-03 |
| B-S-20 | A name that isn't registered, then "Register a new patient" | The name prefilled | "Full name" prefilled with "Meenakshi Sundaram" | PASS |

### Bookings in the UI, and the slot boundaries

| ID | Scenario | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| B-UI-01 | New patient Asha Rao, mobile typed `+91 98765 43210`; Dr. Iyer, Tue 20 Oct, **09:00, the first slot of a session** | 201; mobile stored as 10 digits; toast; the scheduler opens on that day | 201, PAT-000001, mobile `9876543210`, 09:00-09:15, toast "Booked Asha Rao with Dr. Meera Iyer …", back on the scheduler | PASS | `B-UI-01-after-booking.png` |
| B-UI-02 | Ravi Kumar, **11:45, the last slot before the lunch break** | 201, 11:45-12:00 | 201, PAT-000002 | PASS | |
| B-UI-03 | Priya Sharma, **13:00, the first slot after lunch** | 201 | 201, PAT-000003 | PASS | |
| B-UI-04 | Mohammed Ali, mobile `+91-90000-12345`, **16:45, the last slot, ending exactly at the 17:00 session end** | 201, 16:45-17:00 | 201, mobile `9000012345` | PASS | |
| B-UI-05 | Lakshmi Narayanan, mobile `(0) 98450 11223`; Dr. Qureshi, Wed 21 Oct, 10:00 | 201 | 201, mobile `9845011223` | PASS | |
| B-UI-06 | Sunita Patil, mobile `98765.11111`; **11:30-12:00, the last slot before the 15 minutes left over before the 12:15 break** | 201 | 201, mobile `9876511111` | PASS | |
| B-UI-07 | Kiran Joshi, mobile `919812345678`, gender Other; **13:15-13:45, before the 13:45-14:00 leftover** | 201 | 201, mobile `9812345678` | PASS | |
| B-UI-08 | José Álvarez; **17:30-18:00, ending exactly at the session end** | 201 | 201 | PASS | |
| B-UI-09 | श्रीमती आशा राव; Dr. Verma **today at 03:00 (a same-day booking)** | 201 | 201, PAT-000009 | PASS | `B-UI-09-after-booking.png` |
| B-UI-10 | `Zoë O'Brien-Smith 😀`, purpose "Palpitations ❤️" | 201, stored exactly | 201; stored and shown exactly | PASS | |
| B-UI-11 | Name `<script>alert('xss')</script>`, purpose `<b>bold</b><script>window.__xss2=1</script>`, notes `<img src=x onerror="window.__xss3=1">`; today 19:20 | 201, stored verbatim, never run | 201; stored verbatim; no dialog and no script ran (see B-H) | PASS | `B-UI-11-after-booking.png` |
| B-UI-12 | Name `<img src=x onerror="window.__xss=1">`, purpose `"><svg onload=window.__xss4=1>`; today 19:00 | The same | The same | PASS | |
| B-UI-13 | Existing patient found by `PAT-000001` | 201 for PAT-000001 | 201 | PASS | |
| B-UI-14 | Existing patient found by `91234` | 201 for Ravi Kumar | 201 | PASS | |
| B-UI-15 | Existing patient found by `pri` | 201 for Priya Sharma | 201 | PASS | |
| B-UI-16 | **A new patient with a mobile that already exists** (Arjun Rao with Asha Rao's 9876543210) | Report the behavior | 201. A second patient record, PAT-000013, is created with the same mobile, and the form shows no hint that the number is already registered. A search for 9876543210 now returns both. | QUESTION Q-02 | `B-UI-16-new-patient-existing-mobile.png`; `patients` grouped by mobile: `9876543210` → Asha Rao, Arjun Rao |
| B-UI-17, 18 | The second receptionist books existing patients found by `Mohammed` and by `ASHA rao` | 201 | 201 each | PASS | |
| B-UI-19 | Fatima Sheikh; Dr. Verma, **20:40-21:00, the last slot before the off-grid 21:10 break** (21:00-21:10 is left over) | 201 | 201 | PASS | |
| B-UI-20 | **21:25, the first slot after the off-grid break**, existing patient found by `fat` | 201 | 201 | PASS | |
| B-B-01 | Slot grid, Dr. Iyer Tue 20 Oct: the API and the booking form's time picker | 09:00-11:45 and 13:00-16:45 every 15 minutes: 28 slots; none at 12:00-12:45 or 17:00 | API 28 slots and UI 28 radios, identical; first 09:00-09:15, last 16:45-17:00; no overlaps | PASS | `B-B-2026-10-20-d80a.png` |
| B-B-02 | Slot grid, Dr. Qureshi Wed 21 Oct | 10:00, 10:30, 11:00, 11:30, 12:45, 13:15, 16:00, 16:30, 17:00, 17:30. **No 12:00** (only 15 minutes before the break) and **no 13:45** (15 minutes before the session end). | Exactly these 10, in the API and the UI | PASS | `B-B-2026-10-21-d80e.png` |
| B-B-03 | Slot grid, Dr. Verma Tue 20 Oct | 02:20 to 04:00 (6 slots, **no 04:20**), 19:00 to 20:40, then 21:25 to 23:25. **No 21:00** (10 minutes before the break), and **no 23:45** (5 minutes left). Slots restart at the end of the off-grid break. | Exactly these 19 | PASS | `B-B-2026-10-20-d812.png` |
| B-V-01 | 50 more bookings through the API, alternating between the two receptionists, 10 of them registering new patients | All 201 | 50 × 201 | PASS | `appointments.countDocuments() = 72` (with B-X-53 and B-X-54) |

### Bypassing the UI with crafted requests

Every request below was sent with a receptionist's valid token to `POST /appointments` (unless another path is given), with an otherwise valid body. "Safe body" means the standard envelope with `data: null`, a request id, and no stack trace, driver error, `E11000`, file path or URI.

| ID | Request | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| B-X-01 | Past date: Sat 17 Oct, 09:00 (a working day) | 422 | 422 "This slot is in the past" | PASS |
| B-X-02 | Long-past date, 2020-01-06 | 422 | 422 "This slot is in the past" | PASS |
| B-X-03 | Past time today: Dr. Verma's 02:20 slot, sent at 02:20 IST (the slot's start minute) | 422 | 422 "This slot is in the past". A slot counts as started from its start minute. The first run (02:01) was skipped because nothing had started yet. | PASS |
| B-X-04, 05 | Lunch break: 12:00 and 12:30 | 422 | 422 "This time is not a slot in the doctor's schedule" | PASS |
| B-X-06 | Break start inside a session (12:15) | 422 | 422, the same | PASS |
| B-X-07, 08, 09 | Leftovers that don't fit a slot: 12:00 (Dr. Qureshi), 13:45 (Dr. Qureshi), 04:20 (Dr. Verma) | 422 | 422 each | PASS |
| B-X-10 | Off-grid break, 21:10 | 422 | 422 | PASS |
| B-X-11 | The session end itself, 17:00 | 422 | 422 | PASS |
| B-X-12 | Off-grid time 09:07 | 422 | 422 | PASS |
| B-X-13, 14, 15 | Times `9:00`, `09:00:00`, `25:00` | 400 | 400 `body.slotStart: Must be a time in HH:mm format` | PASS |
| B-X-16, 17 | Dates `2026-02-30` and `27-10-2026` | 400 | 400 `body.date: Must be a date in YYYY-MM-DD format` | PASS |
| B-X-18, 19, 20 | Non-working days: Dr. Qureshi on a Tuesday, Dr. Iyer on a Sunday, Dr. Leave Cover on any day | 422 | 422 "This time is not a slot in the doctor's schedule" | PASS |
| B-X-21 | Doctor/department mismatch (Dr. Iyer with Cardiology) | 422 | 422 "The doctor does not belong to this department" | PASS |
| B-X-22 | Unknown department id | 422 | 422, the same | PASS |
| B-X-23, 24 | Invalid ObjectIds (`123`, `not-an-id`) | 400 | 400 "Must be a valid id" on the field | PASS |
| B-X-25, 26 | Unknown doctor, unknown patient (valid ids) | 404 | 404 "Doctor not found" and "Patient not found" | PASS |
| B-X-27 to 30 | `GET /appointments/123` (400), `GET` an unknown id (404), `POST /appointments/123/arrive` (400), `PUT` an unknown id (404) | As listed | As listed | PASS |
| B-X-31, 32, 33 | Oversized strings: purpose 201, notes 2001, name 101 characters | 400 | 400 "Too big: expected string to have <=200 / <=2000 / <=100 characters" | PASS |
| B-X-34 | A 150 KB body | 413 | 413 "Request body is too large" | PASS |
| B-X-35 | Purpose of spaces only | 400 | 400 "Required" (trimmed first) | PASS |
| B-X-36, 37 | `{}`, and a body without `purpose` | 400 listing the fields | 400 with `doctorId`, `date`, `slotStart` and `purpose` listed | PASS |
| B-X-38, 39 | Neither, or both, of `patientId` and `newPatient` | 400 | 400 "Provide either patientId … or newPatient, but not both" | PASS |
| B-X-40 to 46 | New patient without gender; mobiles `12345`, `5876543210`, `98765432101` and `+1 555 123 4567`; a future date of birth; gender `male` | 400 | 400 on the right field each time ("Must be a 10-digit Indian mobile number", "Cannot be in the future", "Invalid option") | PASS |
| B-X-47, 48 | Purpose as a number, date as an array | 400 | 400 "expected string" | PASS |
| B-X-49, 50 | Operator objects: `slotStart: {"$gt": ""}`, `doctorId: {"$ne": null}` | 400 | 400 "expected string, received object". The `$` keys were stripped, and validation refused what was left. | PASS |
| B-X-51 | Malformed JSON | 400 | 400 "Malformed JSON in request body" | PASS |
| B-X-52 | JSON sent as `text/plain` | 400 | 400 `body: expected object` | PASS |
| B-X-53 | Mass assignment: `status: COMPLETED`, `createdBy` (another user), `slotEnd: 23:59`, `patientName`, `doctorName` and `arrivedAt` in the body | Ignored | 201. Stored with status SCHEDULED, `createdBy` the caller, `slotEnd` 09:30 (from the schedule), the real patient and doctor names, and no `arrivedAt` | PASS |
| B-X-54 | Purpose of exactly 200 and notes of exactly 2000 characters | 201 | 201, stored in full | PASS |
| B-X-55 | Is there a booking horizon? 2099-10-19, with an unknown patient id | | 404 "Patient not found". The patient check runs only after every slot rule passes, so a slot 73 years ahead is bookable. | QUESTION Q-04 |

Every rejected response above had a safe body.

### Hostile input on screen

The two hostile patients (B-UI-11, B-UI-12) were opened on every screen that shows them, as Anita Desai and as Dr. Nisha Verma, whose appointments they are. On each screen the check confirmed four things: the exact text is visible; none of the marker globals (`window.__xss`, `__xss2`, `__xss3`, `__xss4`) exists; no `img[src=x]`, `svg[onload]` or injected `<script>` element is in the DOM; and no dialog opened.

| ID | Screen | Result | Evidence |
| --- | --- | --- | --- |
| B-H-01 | Dashboard, "Up next" | PASS: shown as text, nothing ran | `B-H-reception1-dashboard.png`, `B-H-doctor3-dashboard.png` |
| B-H-02 | Scheduler tiles | PASS, but BUG-04 (fixed): a long name without spaces pushes its tile into the next one | `B-H-reception1-scheduler.png` |
| B-H-03 | Appointment details dialog (purpose and notes) | PASS | `B-H-reception1-details.png` |
| B-H-04 | Appointment list | PASS, but BUG-04 (fixed): at 1280 px a long word clips the row actions | `B-H-reception1-list.png` |
| B-H-05 | Booking toast and the patient search results | PASS: no dialog during the 20 bookings, and the search result shows the name as text (B-S-16) | |

Stored data: the names are stored verbatim (`PAT-000011` `<script>alert('xss')</script>`, `PAT-000012` `<img src=x onerror="window.__xss=1">`). Unicode names are stored as typed, with lowercase copies for search (`josé álvarez`, `zoë o'brien-smith 😀`; Devanagari has no case).

## Group C: The lifecycle, back and forth

| ID | Scenario and steps | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| C-01 | In the list, Anita Desai clicks "Mark Priya Sharma as arrived"; then Dr. Meera Iyer, in her own list, clicks "Complete Priya Sharma's visit" | SCHEDULED → ARRIVED → COMPLETED, with timestamps and audit entries | The receptionist is offered no "Complete" button. After each click the status badge changes in place. In the DB, status COMPLETED, `arrivedAt` 20:38:36Z, `completedAt` 20:38:40Z, no `cancelledAt`. Audit: CREATE (RECEPTIONIST), ARRIVE (RECEPTIONIST), COMPLETE (DOCTOR). | PASS | `6ad52b9e5099159b77ebd84e`; `C-01-arrived.png`, `C-01-completed-by-doctor.png` |
| C-02 | Cancel a SCHEDULED appointment from the list, through the confirm dialog | CANCELLED, and the slot free again | The dialog "Cancel this appointment?" opens with focus on the safe choice, "Keep appointment". After confirming: CANCELLED with `cancelledAt` set, and `GET /slots` shows 11:45 AVAILABLE again. | PASS | `6ad52b9b5099159b77ebd849`; `C-02-cancel-confirm.png` |
| C-03 | Mark arrived, then cancel (from ARRIVED) | CANCELLED | CANCELLED, with both `arrivedAt` and `cancelledAt` kept | PASS | `6ad52ba15099159b77ebd853` |
| C-04a | Arrive twice (API) | 200, then 409 | 200, then 409 "This appointment is arrived and cannot be marked as arrived" | PASS | `6ad52bbe5099159b77ebd87f` |
| C-04b | Arrive a cancelled appointment | 409 | 409 "… is cancelled and cannot be marked as arrived" | PASS | |
| C-04c, d | Cancel a completed appointment; cancel a cancelled one | 409 | 409 "… is completed and cannot be cancelled"; "… is cancelled and cannot be cancelled" | PASS | |
| C-04e, f | Edit the purpose, or the notes, of a cancelled appointment | 409 | 409 "This appointment is cancelled and cannot be updated", both | PASS | |
| C-04g | Edit the purpose of a completed appointment | 409 | 409 "… is completed and cannot be updated" | PASS | |
| C-04h | Edit the notes of a completed appointment | 200 (documented: notes stay editable after the visit) | 200 | PASS | |
| C-04i, k, l | Complete a SCHEDULED or a CANCELLED appointment (Super Admin); arrive a completed one | 409 | 409 with the current status named each time | PASS | |
| C-04j | Complete as a receptionist | 403 | 403 "You do not have permission to perform this action" | PASS | |
| C-04m | The Super Admin completes an ARRIVED appointment | 200 | 200, COMPLETED. Audit: ARRIVE (RECEPTIONIST), COMPLETE (SUPER_ADMIN). | PASS | `6ad52bbe5099159b77ebd87f` |
| C-05 | A stale row: Anita's list shows Lakshmi Narayanan as Scheduled; Rahul cancels it through the API; Anita then clicks "Arrived" on her old row | A clear message; the row is corrected | The 409 message "This appointment is cancelled and cannot be marked as arrived" is shown, and the row refreshes to Cancelled. (The list joins no live room, so the change only reaches it this way or by refetching.) | PASS | `6ad52ba55099159b77ebd858`; `C-05-stale-arrive.png` |
| C-06 | The same slot (Dr. Iyer, Thu 22 Oct, 11:00) booked, cancelled and rebooked 3 times in the UI by alternating receptionists: Anita books and cancels, Rahul rebooks and cancels, Anita rebooks and cancels, Rahul rebooks | Several CANCELLED documents and one active one coexist | Four documents for `{doctorId, date: 2026-10-22, slotStart: 11:00}`: 3 CANCELLED (Asha Rao, Ravi Kumar, Priya Sharma) and 1 SCHEDULED (Mohammed Ali). The unique index covers only active statuses, so it allows this. | PASS | `6ad52e605099159b77ebd961`, `…966`, `…96b` (CANCELLED), `6ad52e6f5099159b77ebd970` (SCHEDULED); `C-06-rebooked-slot.png` |
| C-07 | Is there a way to complete in the UI, and who has it? An ARRIVED appointment of Dr. Iyer, opened by four users | Complete offered to the appointment's doctor and the Super Admin only | Receptionist: no "Complete" button. Dr. Meera Iyer: "Complete Ravi Kumar's visit". Dr. Farhan Qureshi: the row isn't visible at all. Super Admin: "Complete" offered. It is also in the details dialog ("Complete visit"). No requirement gap: the assessment names COMPLETED in the workflow without saying who sets it, and the app gives it to the treating doctor and the Super Admin. | PASS | `C-07-admin-complete.png` |

Status counts after Group C: SCHEDULED 67, CANCELLED 6, COMPLETED 2, ARRIVED 1. Rejected changes (the 409s and 403s) write no audit entry, and nothing in the database changed for them.

## Group D: The doctor role

Each doctor logged in through the form. Their API tokens were used for the scoping checks.

| ID | Scenario | Dr. Meera Iyer | Dr. Farhan Qureshi | Dr. Nisha Verma | Result |
| --- | --- | --- | --- | --- | --- |
| D-01 | Navigation | Dashboard, Scheduler, Appointments (no booking, no admin) | The same | The same | PASS |
| D-02 | Dashboard shows only their own day | No other doctor named. 0 appointments today, so the empty state shows | The same | Their 5 appointments today, no other doctor named | PASS (`D-02-*-dashboard.png`) |
| D-03 | List: only their appointments, with the total equal to the DB count. The list has no Doctor column for a doctor; each row's patient was checked against the DB. | "Showing 1–39 of 39"; DB 39 | 18 of 18; DB 18 | 19 of 19; DB 19 | PASS |
| D-04 | "By URL": another doctor's scheduler (`/scheduler?doctor=<other>`) and a list URL with `?doctorId=<other>&doctorName=<other>` | The scheduler shows their own day ("Dr. Meera Iyer"), with no doctor selector and no booking links. The list is unchanged: 39 of 39, their own. | The same, their own | The same, their own | PASS |
| D-05 | "By API id": `GET`, `PUT` (notes) and `POST …/complete` on another doctor's appointment; `GET /slots` and `GET /doctors/:id` for another doctor; `GET /patients`; `GET /appointments?doctorId=<other>` and `?doctorName=<other>` | 404, 404, 404, 403, 404, 403. Both list filters are ignored (total 39 = own). `GET /doctors` returns only themselves. The other doctor's notes are unchanged. | The same (own 18) | The same (own 19) | PASS |
| D-06 | Notes only: the API refuses `purpose` (alone, or with `notes`); the UI's edit dialog shows the purpose as text and only the notes as a field, and sends only `notes` | 403 "Doctors can only update consultation notes" for both; no purpose textbox; request body `{"notes": …}`; saved, with the purpose unchanged | The same | The same | PASS (`D-06-*-notes-saved.png`) |
| D-07 | Can't book, cancel or check in: `/appointments/new` and `/admin`; buttons in the list; `POST /appointments`, `DELETE`, `POST …/arrive` | "You don't have access to this page" for both pages; 0 cancel and 0 arrive buttons; API 403, 403, 403 | The same | The same | PASS |
| D-08 | Patient information on their own appointment | `GET /appointments/:id` gives the full patient (`gender`, `dateOfBirth`); the scheduler's dialog shows the name and patient ID | The same | The same | PASS (`D-08-*-patient.png`) |

## Group E: Concurrency and real time (real network)

| ID | Scenario and steps | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| E-01 | Two receptionists (Anita, Rahul) in separate browser windows fill in the booking form for the same slot and press "Book appointment" together. A network barrier holds both POSTs until both are sent, then releases them at once. Repeated on 10 slots (Dr. Iyer, Tue 27 Oct, 13:00 to 15:15); rounds 1-5 with existing patients, rounds 6-10 with a new patient on each side. | One booking per slot; the loser gets a clear message and a refreshed grid | 10 of 10 rounds gave exactly one 201 and one 409. The winners were Anita 3 times and Rahul 7. The loser saw "Someone else booked 13:00 a moment ago. Choose another time." (with that round's time), with everything typed kept, and the slot disabled in the refetched time picker. Each slot has exactly 1 active document. The five losing new-patient bookings left **0 orphan patient records**: 5 new patients for 5 winners. | PASS | `E-01-round1-loser.png`, `E-01-round6-loser.png` |
| E-02a | 20 parallel `POST /appointments` for one slot (Dr. Verma, 22 Oct, 02:40), 20 different patients, from both receptionists | 1 × 201, 19 × 409, one active document | `{"201": 1, "409": 19}`, all 409s "Slot already booked". 1 active document (`6ad5301c5099159b77ebda15`), 1 CREATE audit entry for the slot | PASS | |
| E-02b | 20 parallel POSTs for 20 different slots (Dr. Iyer, 28 Oct, 09:15 to 15:45) | All succeed | 20 × 201, 20 active documents | PASS | |
| E-03a | Arrive and cancel the same appointment in parallel, 10 times on fresh appointments | Every final state valid and consistent | 9 trials: 200/200 → CANCELLED with both `arrivedAt` and `cancelledAt`. 1 trial: arrive 409 / cancel 200 → CANCELLED without `arrivedAt`. Timestamps and audit entries (ARRIVE, CANCEL) match the requests that won. | PASS | |
| E-03b | Complete (Super Admin) and cancel (receptionist) an ARRIVED appointment in parallel, 5 times | Exactly one wins | 5 × complete 200 / cancel 409 → COMPLETED with no `cancelledAt` | PASS | |
| E-03c | Change the purpose and cancel in parallel, 5 times | No change lands on a cancelled appointment | 5 × update 409 / cancel 200 → CANCELLED, purpose unchanged | PASS | |
| E-03d | Two parallel cancellations | One 200, one 409 | `{"200": 1, "409": 1}`, 1 CANCEL audit entry | PASS | |
| E-04a | Two parallel new-patient bookings with identical details (name, mobile, gender, date of birth) on two slots | Report | Both 201, and **two patient records**: PAT-000035 and PAT-000036 | QUESTION Q-02 | `patients.find({ mobile: '9900990099' })` → 2 |
| E-04b | 10 parallel new-patient bookings on 10 slots | Unique codes, no gaps | 10 × 201, codes PAT-000037 to PAT-000046, unique and contiguous (the counter is one atomic `$inc`) | PASS | |
| E-05a | Real time, 3 windows: Anita and Rahul on Dr. Iyer's 29 Oct; Dr. Verma on her own 29 Oct. The Super Admin books Dr. Iyer 10:00 through the API. | Both of Dr. Iyer's windows update live; Dr. Verma's gets nothing | Both tiles turned BOOKED "Asha Rao" without a reload, within 179 ms. Each of the two windows received one `appointment:created`; Dr. Verma's received none. Screen readers were told "10:00 was just booked for Asha Rao." | PASS | `E-05a-live-create-window2.png` |
| E-05b | Change the purpose | `appointment:updated` in the room only | Received by both windows (283 ms), not by Dr. Verma | PASS | |
| E-05c | Mark arrived | The tile shows "Arrived" live | Both tiles changed to "Arrived" (98 ms); no event reached the other room | PASS | |
| E-05d | Cancel | The tile is free again | Both tiles became "Available" again (106 ms); `appointment:cancelled` in the room only | PASS | |
| E-05e | Book for Dr. Verma | Only her window | Her tile updated; events received by windows 1/2/3: 0/0/1 | PASS | `E-05e-doctor-window.png` |
| E-05f | Rahul leaves the scheduler through the menu (Appointments), then a booking for Dr. Iyer 29 Oct | `scheduler:leave` sent; no more events | `scheduler:leave {doctorId, date: 2026-10-29}` sent and the socket closed (nothing else needed it). The next booking reached Anita (1 event) and not Rahul (0). A first attempt used `page.goto`, a full reload: no leave is sent then, because the old document and its socket simply end. | PASS | |
| E-05g | "Next day" on the scheduler | Leave the old day's room, join the new one | Sent `scheduler:leave(2026-10-29)` then `scheduler:join(2026-10-30)`. A booking on the old day reached it 0 times; one on the new day arrived and its tile updated live. | PASS | |
| E-06 | Restart the backend (hard kill, down for 3 s) while Anita's and Dr. Verma's windows stay open | The socket reconnects and rejoins | While the API was down, the indicator read "Live updates: Offline, reconnecting". It was "Live" again 14 s after the kill. `scheduler:join` was re-sent for 2026-10-29, and the next booking (10:45) appeared live. The only console errors were `ERR_CONNECTION_REFUSED` for socket polling during the outage, which is expected. | PASS | `E-06-while-down.png`, `E-06-after-restart.png` |
| E-07 | After an access-token refresh, the socket stays authorized | | Tested with a short-lived token in [Group F](#group-f-auth-and-security) (F-02) | See F-02: PASS | |

## Group F: Auth and security

Temporary server settings, each restored afterwards: `NODE_ENV=production` with `JWT_ACCESS_TTL_SECONDS=30` for F-09b and F-02, and with `=90` for F-01; the default `RATE_LIMIT_MAX=300` for F-06. The client keeps a 30-second freshness margin on the access token (`EXPIRY_MARGIN_MS`), so a 30-second token never counts as fresh. That is why F-01 was rerun with 90 seconds.

| ID | Scenario and steps | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| F-01 | The access token expires (90 s) while a receptionist sits on the list page. An in-app navigation then opens the scheduler with a doctor and date already set. | One silent refresh; every request that got 401 is retried once | 4 parallel requests (`/doctors`, `/doctors/:id`, `/slots`, `/appointments`) each got 401. Exactly one `POST /auth/refresh` (200) followed, and each request was retried once with the new token (200). The user stayed signed in. | PASS | `F-01-silent-refresh.png` |
| F-02 | The scheduler stays open past a token's lifetime (30 s) | The socket stays authorized | The server closed the socket at token expiry. The client refreshed (200), reconnected and re-sent `scheduler:join`, and a booking made afterwards appeared live. The indicator showed "Live". | PASS | |
| F-03 | Log in twice as Rahul Menon (two sessions). Log out one through the API, then replay its old refresh cookie. | 401, and `revokedAt` set | Logout 200 and the cookie cleared (`Expires=Thu, 01 Jan 1970`). In the DB, `revokedAt` set (20:53:24Z). The replay got 401 "Your session has expired, please log in again". Replaying a logged-out token counts as reuse, so **the user's other session was revoked too** (as documented), and a `REFRESH_TOKEN_REUSE` audit entry was written. | PASS | `refresh_tokens` by hash; audit `REFRESH_TOKEN_REUSE` |
| F-03b | Log out in the UI, then replay the browser's old cookie through the API | The same | `revokedAt` set, no cookie left in the browser, the replay got 401 | PASS | `F-03b-after-logout.png` |
| F-04 | Replay an already-rotated refresh token | Reuse detection revokes every token of the user | The rotation set `revokedAt` and `replacedByHash` = SHA-256 of the new token. The replay got 401, and so did the newest token afterwards. 0 unrevoked tokens were left for the user. | PASS | `refresh_tokens.countDocuments({ userId, revokedAt: { $exists: false } }) = 0` |
| F-05 | An inactive user can't refresh: Vikram Sethi was activated, logged in, then deactivated | 401 | The refresh got 401 "Your session has expired, please log in again", and that token was revoked. The access token he already had still worked until it expired (documented: deactivation takes effect within the token's lifetime). | PASS | |
| F-06a | Login rate limit: 11 failed logins in the UI, then the right password | 429 with a clear message | 10 × 401, then 429. The UI says "Too many failed attempts from this device. Wait 15 minutes, then try again." The right password is refused too (API 429, `Retry-After: 886`). | PASS | `F-06a-login-rate-limit.png` |
| F-06b | Global rate limit, at its default of 300 per 15 minutes | 429 | 429 "Too many requests, please try again later" once the window's 300 requests were used, with `Retry-After` and `RateLimit-Policy: "300-in-15min"` | PASS | |
| F-07 | Wrong password and unknown email | The same message | Both "Invalid email or password"; the bodies are identical apart from the request id (A-19b). Mean time 381 ms vs 558 ms (the unknown email is compared against a dummy hash). | PASS | |
| F-08 | Every captured API response (1,227 bodies from the API scripts and the browsers) scanned for `passwordHash`, bcrypt hashes, `tokenHash`/`replacedByHash`, refresh tokens, the JWT secrets, the Mongo URI, stack traces, driver errors (`E11000`, `CastError`), the test passwords and internal fields (`__v`, `nameLower`, `isActive`) | None | None, apart from one stack trace: the deliberate 500 of F-09a in development mode, where it is documented. The same request in production mode (F-09b) gave a clean body. | PASS | `qa/scan-responses.mjs` |
| F-09a | Force a 500, development mode | Safe body | A JSON body of 20,000 nested arrays (40 KB, under the 100 KB limit) got **500 "Internal server error"**, with `meta.stack` because the mode is development. The cause is `RangeError: Maximum call stack size exceeded` in `stripUnsafeKeys`, which recurses once per level. It runs before authentication, so any anonymous client can trigger it. The process doesn't crash. | FAIL → fixed, BUG-05 | API log |
| F-09b | The same, `NODE_ENV=production` | Safe body | `{"success":false,"message":"Internal server error","data":null,"meta":{"requestId":"7ce9e829-…"}}`: no stack, no error name | PASS | |
| F-10a | Receptionist token on `POST /doctors`, `POST /users/receptionists`, `PUT /doctors/:id/schedule` | 403, nothing changes | 403 × 3; Dr. Iyer still has 6 working days | PASS | |
| F-10b | Doctor token on the same, and on `GET /patients` | 403 | 403 × 4 | PASS | |
| F-10c | No token on all 15 protected endpoints | 401 | 401 "Authentication required" on every one | PASS | |
| F-10d | A receptionist's token with the role edited to SUPER_ADMIN (old signature); `alg: none`; expired; signed with another secret; the right secret but the refresh audience; an unknown role claim; the refresh token used as an access token; garbage | 401 | 401 "Invalid token" for each, and "Token has expired" for the expired one. 0 users created. | PASS | |
| F-11a | Login with `{"email":{"$gt":""},"password":{"$gt":""}}`, `{"password":{"$ne":null}}`, `{"email":{"$regex":".*"}}`, `{"email.$":"x"}` | 400 | 400 "Validation failed" for each. The `$` and dotted keys are stripped first, then the empty values fail validation. | PASS | |
| F-11b | Operators in query strings: `/patients?search[$gt]=`, `search[$regex]=.*`, `/appointments?status[$ne]=CANCELLED`, `patientName[$regex]=.*`, `sortBy[$gt]=x`, and JSON text as the value | Rejected with 400 (the brief) | **200, never interpreted.** Express 5's simple parser keeps `search[$gt]` as a literal key, which no schema knows, so it is ignored like any unknown parameter. The request runs without that filter (all 41 patients, all 148 appointments, which these roles may list anyway). JSON text as a value is a literal string: 0 matches. No injection is possible, but the answer is 200, not 400. | QUESTION Q-05 | |
| F-12 | Browser storage and the cookie, after logging in and using the app | No tokens stored; cookie `HttpOnly`, `Secure`, `SameSite` | localStorage 0 keys; IndexedDB none; `document.cookie` empty; no JWT anywhere. `emr_refresh`: httpOnly, secure, SameSite=Strict, Path=/api/v1/auth, 7 days. sessionStorage holds one key, `react-router-scroll-positions` (scroll offsets from React Router's scroll restoration), with no token and no patient data. | PASS (INFO: the router library uses sessionStorage) | |
| F-13 | Foreign origin: requests with `Origin: https://evil.example`, and a real page served at https://evil.example calling the API with credentials | Blocked | No `Access-Control-Allow-Origin` for the foreign origin, on the request or the preflight (204 without ACAO). The own origin gets ACAO `http://localhost:5173` with credentials. From the evil page, `GET /departments`, `POST /auth/refresh` and `POST /auth/login` all fail with "TypeError: Failed to fetch". | PASS | |
| F-13b | Can a foreign page log staff out? From https://evil.example: no-cors `fetch` POSTs to `/auth/refresh` and `/auth/logout`, then a plain HTML form POST to `/auth/logout` | The session survives | The fetches had no effect: Chrome ignores `Set-Cookie` on cross-site subresource responses. But **the form POST deleted the refresh cookie**. The cookie isn't sent cross-site (SameSite=Strict), so nothing is revoked, yet the logout response always sends a clearing `Set-Cookie`, which the browser applies on a top-level navigation. After a reload the receptionist was on /login. The same works through `/auth/refresh`, whose failures also clear the cookie. | FAIL → fixed, BUG-06 | |
| F-14 | Security headers (helmet) | | CSP `default-src 'self'` …, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, HSTS 1 year, `Referrer-Policy: no-referrer`, CORP same-origin, no `X-Powered-By`, plus `X-Request-Id` | INFO | |

Observations from this group (not bugs):
- Both rate limits count per client IP. In a clinic where every PC shares one public IP, ten mistyped passwords lock everyone out of logging in for 15 minutes. And 300 requests per 15 minutes is shared by every open screen (an open scheduler and dashboard each poll once a minute). `RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX` and `TRUST_PROXY_HOPS` cover this, but the defaults suit one front desk, not a whole clinic behind NAT.
- After a tab has been idle past the token's lifetime, the first requests always fail with 401 before the refresh (F-01), and Chrome logs each one in the console. The client knows the expiry time, so it could refresh before sending, as the socket handshake already does.

## A-20: Schedule edits with booked appointments

Done in the admin UI as the Super Admin, on Dr. Farhan Qureshi, after Group C. Before the edit, his appointments on Fri 23 Oct were 10:00-10:30, 11:00-11:30, 12:45-13:15, 16:00-16:30 and 16:30-17:00, and on Mon 26 Oct 10:00, 11:30 and 16:00. The schedule editor warns: "Saving replaces the whole week. Appointments already booked stay, even if they no longer fit."

| ID | Step | What happened | Result | Evidence |
| --- | --- | --- | --- | --- |
| A-20a | Slot length 30 → 20 minutes, saved | Saved (200). **No appointment changed in the database:** all 5 on Fri 23 kept their 30-minute times. The new grid is 10:00, 10:20, 10:40, 11:00, 11:20, 11:40, 12:45, 13:05, 13:25, 16:00 … 17:40. Four appointments start on the new grid and still show as booked. **16:30-17:00 is on no tile, so it vanished from the day sheet.** Five slots are offered as AVAILABLE although they overlap a booked visit: 10:20-10:40, 11:20-11:40, 13:05-13:25, 16:20-16:40 and 16:40-17:00. | QUESTION Q-07 | `A-20a-grid-after-20-min.png` |
| A-20b | Book one of those slots (10:20) | 201. Dr. Qureshi then had **two active appointments at the same time**: Pooja Nair 10:00-10:30 and Priya Sharma 10:20-10:40. The double-booking index only compares start times, so it can't see the overlap. | QUESTION Q-07 | |
| A-20c | Remove Monday from his week | Saved. Mon 26 Oct has 0 slots, and the scheduler says "no sessions on Mondays. Choose another day." **The 3 booked Monday appointments stay active in the database and in the appointment list, but the day sheet doesn't mention them.** They can still be handled from the list: checking one in returned 200. | QUESTION Q-07 | `A-20c-monday-removed.png` |
| A-20d | Restore the original week (30 minutes, Mon/Wed/Fri with the 12:15-12:45 break) | Saved. The original grid is back and 16:30 shows as booked again. Now the 10:20-10:40 booking from A-20b is the one on no tile. That test booking was then cancelled, so no active overlap remains in the data (H-07). | INFO | `doctors._id 6ad52a0d5099159b77ebd80e` |

## Group G: List, search, filter and sort

Checked against **149 appointments** (8 pages of 20). For each check, a script loaded every appointment from the database and worked out the expected totals and orders on its own, in JavaScript. Strings were compared as UTF-8 bytes, the way MongoDB compares them, and the order ended on `_id`.

| ID | Scenario | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| G-01 | Page boundaries | Exact pages, no gaps or repeats | 149 in total, 8 pages of 20, with 9 rows on the last. Page 9 is an empty `data` array with `totalPages: 8`. `page=0`, `limit=0`, `limit=101` and `page=abc` give 400 ("Too big: expected number to be <=100"). `limit=100` gives 100 rows, then 49. Walking every page gives 149 ids, all unique. | PASS |
| G-02 | Every whitelisted sort, both directions (`date`, `createdAt`, `patientName`, `doctorName`, `status`) | The independent order, stable across pages | 10 of 10: every page walk matches the independent order exactly, with no duplicate and no missing row | PASS |
| G-02b | `sortBy=patientMobile`, `sortOrder=up`, `sortBy=__proto__` | 400 | 400, 400, 400 | PASS |
| G-03 | 25 filters alone and combined: patient name (prefix, capitals), doctor name (contains, including the dot in "dr."), `doctorId`, mobile (prefix, `+91 98765`, full number), department (one with no doctors too), each status, date range with inclusive edges, a single day, from-only, to-only, three 3-way combinations, contradictory filters, empty results | API total = independent count, and every row matches | 25 of 25. Examples: name "asha" 21; Cardiology 42; SCHEDULED 118; 20-22 Oct 46 (the edge days included); single day 21 Oct 10; Cardiology + SCHEDULED + 20-25 Oct 15; `doctorId` of Dr. Iyer + name "qureshi" 0; empty results `total 0, totalPages 0` | PASS |
| G-03b | Invalid filters: `dateTo` before `dateFrom`, an impossible date, letters in `mobile`, status in lower case, a bad `departmentId`, an empty `patientName` | 400, never an empty page | 400 for all 6 | PASS |
| G-04 | In the UI, 5 combinations opened by URL and then reloaded, for example `status=SCHEDULED&departmentId=…&dateFrom=2026-10-20&dateTo=2026-10-25&sortBy=patientName&sortOrder=desc&page=2&limit=10` | UI total = DB count; the reload keeps the URL and the controls | All 5: "Showing 11–15 of 15 appointments" (DB 15); name "asha" 21 (DB 21); mobile 9876 32 (32); doctor "qureshi" + cancelled 1 (1); single day 27 Oct 17 (17). After the reload: the same summary, URL and control values. | PASS |
| G-05 | Driving the URL from the controls: typing a name, picking a status, Next page, Rows per page 50, Clear filters | The URL follows; the totals are right | Name + status "Showing 1–17 of 17" (DB 17). Page 2 "21–40 of 118". 50 per page "1–50 of 118". After clearing "1–50 of 149", URL `?limit=50`. | PASS |
| G-06 | `explain("executionStats")` on every list and search shape at this volume | Flag every COLLSCAN | **4 COLLSCANs**, all in lists without a filter: the default appointment list (sort `date, slotStart, _id`: COLLSCAN of 149 + an in-memory SORT), the list sorted by patient name, the list sorted by `createdAt`, and the patient list without a search term. Every filtered shape uses an index: `status_1_date_1`, `departmentId_1_date_1`, `date_1_slotStart_1`, `patientNameLower_1`, `patientMobile_1`, `doctorId_1_date_1` (also for `doctorName` → `$in`), and the slot grid on `uniq_active_doctor_slot` (12 keys, 12 docs). Filtered counts use COUNT_SCAN. The first three COLLSCANs are already documented, with a fix, in DATABASE_DESIGN.md §10; the `createdAt` sort is not. | INFO, Q-06 |

## Group H: Direct database verification

Read-only queries on `emr_manual_qa` after Group G, apart from H-02b, which renamed one test patient and put the name back. Counts at that point: 150 appointments, 41 patients, 4 doctors, 8 users, 362 audit entries, 253 refresh tokens. The whole group was run again at the end, after the fixes and retests (154 appointments, 43 patients, 410 audit entries, 370 tokens), with the same results. The leak scan (F-08) was also repeated then, over 1,920 response bodies: still clean, apart from the one deliberate development-mode 500 of F-09a.

| ID | Check | Result | Evidence |
| --- | --- | --- | --- |
| H-01 | Every appointment has all its fields: references, date and times in the right formats with `slotEnd` after `slotStart`, a known status, `cancelledAt` set exactly when CANCELLED, `arrivedAt` and `completedAt` where the status needs them, an up-to-date lowercase name copy, and the doctor's department | PASS: 150 of 150, no problems | |
| H-02 | The copied `patientCode`, `patientName`, `patientMobile` and `doctorName` match the patient and doctor documents | PASS: 0 mismatches in 150 | |
| H-02b | What a patient edit would do. The app has no screen or endpoint to edit a patient, so "Parallel Patient 10" was renamed directly in the database, checked, and renamed back. | INFO: the detail view showed the new name (it reads the patient). The list row kept the old name, list search found it by the old name only, and patient search found the new name. So an edit would leave lists out of step until the copies were updated, as DATABASE_DESIGN.md says. | |
| H-03 | Audit entries per action: present, with user, role, action, entity, entityId and timestamp | PASS for every required action: LOGIN 76, LOGIN_FAILED 22, CREATE APPOINTMENT 150, CREATE PATIENT 41, UPDATE 5, CANCEL 24, ARRIVE 20, COMPLETE 7, plus CREATE USER 3, CREATE DOCTOR 4, UPDATE DOCTOR 3. 6 LOGIN_FAILED entries have no user or role, because the email was unknown. **LOGOUT (2) and REFRESH_TOKEN_REUSE (5) had a user but no role:** BUG-07, fixed and retested (R-08). | `audit_logs` |
| H-03b | Audit entries agree with each appointment's state: CREATE always, ARRIVE / COMPLETE / CANCEL exactly when the timestamp is set | PASS: 150 of 150 agree | |
| H-04 | Refresh tokens are stored hashed | PASS: 253 tokens with fields `userId, tokenHash, expiresAt, userAgent, ip, createdAt, replacedByHash, revokedAt`. Every hash is 64 hex characters, and no stored value holds a JWT. 214 are revoked. | |
| H-05 | No orphans: appointments → patient, doctor, department and creator; doctors → user and department; DOCTOR users without a profile; patients without an appointment; tokens → user; audit entries → appointment, patient and user | PASS: 0 in all 12 checks. The E-01 race losers left no patient behind. | |
| H-06 | Aggregation: active appointments grouped by `{doctorId, date, slotStart}` with a count over 1 | PASS: **0 duplicate active groups**. One slot holds 4 documents, 3 of them CANCELLED (C-06). | |
| H-07 | Time overlaps between active appointments of the same doctor and day (stricter than H-06) | PASS: none among 126 active appointments, after the A-20b test booking was cancelled | |
| H-08 | Patient codes are unique and sequential | INFO: 41 unique `PAT-NNNNNN` codes from 1 to 46, with the counter at 46. **5 numbers are missing:** PAT-000026, 028, 030, 032 and 034, reserved by the new-patient bookings that lost the E-01 races. That is by design: the code is taken from the counter before the transaction. In the final rerun, PAT-000047 was missing too, burned by the first I-05b run, a new-patient booking that got 409. | `counters.patientCode.seq = 46`, 49 at the end |
| H-09 | Passwords | PASS: all 8 users are bcrypt cost 12, and all emails are lowercase | |

## Group I: Cross-cutting

The first run happened on Monday 19 Oct, the reruns (marked "rerun") on Tuesday 20 Oct.

| ID | Scenario | Expected | Actual | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| I-01 | Browser in America/New_York at 17:10 on **Sun 18 Oct**, while the clinic's clock read 02:42 on **Mon 19 Oct** | "Today", the slots and PAST follow the clinic | Dashboard "Monday, 19 October 2026" (rerun I-01b); the scheduler opens on "Monday, 19 October 2026" with Previous day disabled; the first 6 tiles match the clinic minute (booked, PAST or Available); `?date=2026-10-18` (the browser's today) still shows 19 Oct; the calendar names 18 Oct "unavailable"; the date of birth `max` is 2026-10-19 | PASS | `I-01-America-New_York.png` |
| I-02 | The same in Europe/Berlin (23:10 on Sun 18 Oct) | The same | The same results | PASS | `I-02-Europe-Berlin.png` |
| I-03 | Back and forward: dashboard → scheduler (doctor and next day chosen) → a free tile → booking form | The history works | Back: the scheduler with the same doctor and day. Back again: the dashboard (choosing the doctor and day replaces the history entry instead of adding steps). Forward twice: the booking form with 10:00 chosen. | PASS | |
| I-04 | Reload in the middle of the booking form: a slot chosen, a new patient half typed | | The doctor, day and slot survive (they live in the URL). The patient mode, the typed fields and the purpose are lost, and there is no "leave this page?" prompt. Nothing is kept in browser storage, by design. | INFO | |
| I-05a | Double-click "Book appointment", existing patient | One booking | 1 POST (201), 1 active appointment, a clean console. The button turns disabled with its spinner before the second click lands. | PASS | `I-05a.png` |
| I-05b | Double-click, new patient (rerun on a free slot) | One booking, one patient | 1 POST (201), 1 appointment, 1 patient, 1 code used, a clean console. The first run used a slot that was already booked and got the expected 409. | PASS | |
| I-06 | 2.5 s of latency: switch doctor in the scheduler; change the list's status filter | Loading states | The scheduler shows 13 skeleton tiles until the slots arrive. The list keeps the previous rows, dimmed (`opacity-70`, `aria-busy`), until the new page arrives. | PASS | `I-06-slow-scheduler.png`, `I-06-slow-list.png` |
| I-07a | Offline, open a page whose code hasn't loaded in this tab | A clear error | **Before the fix:** "A newer version is available. The app was updated while this tab was open", which is wrong, since the device was offline. **After:** "You're offline. This page needs a connection to load. Reconnect, then reload the page." with "Reload the page". | FAIL → fixed, BUG-08 | `I-07a-offline-chunk.png` |
| I-07b | Offline, with the scheduler's code loaded: choose another doctor; on the list, change the status filter | An error state | **Before the fix:** no error at all. The scheduler showed skeletons for 45 s and more ("Connecting"), and the list showed the previous, all-Scheduled rows under the filter "Arrived", not dimmed, with no message. **After:** "Couldn't load the slots. Can't reach the server. Check your connection and try again." with "Try again", and on reconnect the day loads again by itself. | FAIL → fixed, BUG-09 | `I-07b-offline-data.png` (before), `I-07b-offline-data-after-fix.png` (after) |
| I-08 | 375 px and 1280 px: dashboard, scheduler, booking, list, admin; the phone menu | No sideways scroll; the menu works | 1280: all fit. 375: **the dashboard scrolled sideways (456 px of content in 360)** because a long name on today's list widened the queue panels. Fixed with BUG-04; with long-text data, all five screens fit at 375, 768 and 1280 (LT-375, LT-768, LT-1280). The phone menu opens, navigates and closes. | FAIL → fixed, BUG-04 | `I-08-375-dashboard.png` (before), `LT-after-375-dashboard.png` (after) |
| I-09 | Console and network across Group I | Clean | No console error or warning, no failed request and no unexpected error response, apart from the declared ones: the offline errors in I-07, and the 401 of the silent refresh on the login page | PASS | |
| I-10 | An open day sheet turns a free slot PAST when its time comes | No reload, no request | Dr. Iyer's day sheet was opened at 10:59 on Tue 20 Oct. The free 11:00 tile ("11:00 Available, book this slot") turned "11:00 Past" at 11:00:11 IST, lost its booking link, and no API request was sent meanwhile. The flip comes from the shared clinic-clock ticker. | PASS | `I-10-past-flip.png` |

## R2: Retest after the Q-01 to Q-07 changes

Run on Tuesday 20 Oct from 15:06 to about 16:45 IST, after the commits that answer Q-02, Q-03, Q-06 and Q-07. The setup was the same as above: the real API and a production build, a visible Chromium, and the Atlas database `emr_manual_qa`, where only the name was changed and the earlier test data was kept. New data was added through the UI. The QA API again ran with `RATE_LIMIT_MAX=100000`. The scripts are `qa/r2-*.mjs`, with their results in `qa/logs/r2-*-results.json` (gitignored). Before the run, `npm run indexes:sync` and `npm run backfill:name-words` were run against this database.

Five checks failed on a first run because of mistakes in my scripts, not in the app:
- wrong test data in three: R2-04a at both widths, and R2-05-BUG09
- a wrong expectation in one: the `--` list filter in R2-03
- a wrong locator in one: R2-06-D

Each is named in its row, and each passed when rerun with the mistake corrected. The retest found three bugs in the app, BUG-10 to BUG-12. All three are fixed, and their rows show the first result and the rerun.

### R2-01: Schedule edits (Q-07)

Dr. Kabir Malhotra (`6ad737400e59a09eb585545d`) was created for this through the admin form: Orthopedics, 30-minute slots, and the standard week of Monday to Friday, 09:00–12:00 and 13:00–17:00. The front desk booked four visits through the scheduler:
- **T:** today, Tue 20 Oct, 16:30–17:00, Meena Pillai, PAT-000024
- **A:** Wed 21 Oct, 10:00–10:30, a new patient, Ritika Sen Gupta, PAT-000050
- **B:** Thu 22 Oct, 11:00–11:30, Asha Rao, found by typing "rao asha"
- **C:** Fri 23 Oct, 15:00–15:30, a new patient, Devendra Nath Mishra, PAT-000051

| ID | Steps | Expected | Actual | Result | DB evidence |
| --- | --- | --- | --- | --- | --- |
| R2-01a | Editor: slot length 30 → 20, Save | Refused, with the 4 bookings listed in the editor, and the schedule unchanged | `409` "This schedule would leave 4 booked appointments without their slots". The editor listed T, A, B and C with day, time, patient and code, each linking to the list filtered to that doctor and day. **First run: the list appeared at the top of the editor, about 1,500 px above the Save button just pressed, so nothing visible happened (BUG-10).** Rerun after the fix: the list and the Save button were both fully in view, at 1280 px (y 601–720 of 800) and at 375 px (y 400–660 of 740). | FAIL (BUG-10), then PASS | Before and after each refusal: slot length 30, 5 days, `scheduleVersion` 0 → 0 |
| R2-01b | Untick Friday, Save | Refused, listing C | `409`, listing only C (Fri 23 Oct 15:00–15:30, Devendra Nath Mishra, PAT-000051). Rerun after BUG-10: removing Monday listed E, in view at both widths. | FAIL (BUG-10), then PASS | Schedule unchanged |
| R2-01c | Thursday: add a break 11:00–11:30 over B, Save | Refused, listing B | `409`, listing only B (Thu 22 Oct 11:00–11:30, Asha Rao, PAT-000001). Rerun after BUG-10: a break over Wed 09:20–09:40 listed D, in view at both widths. | FAIL (BUG-10), then PASS | Schedule unchanged |
| R2-01d | The front desk cancels T, A, B and C from the appointment list | Cancelled | `DELETE` 200 four times | PASS | All four `CANCELLED`, each with `cancelledAt` |
| R2-01e | Repeat: slot length 30 → 20 | Saved; cancelled bookings don't block | `200`, toast "Schedule saved for Dr. Kabir Malhotra" | PASS | Slot length 20, `scheduleVersion` 0 → 1 |
| R2-01f | Repeat: untick Friday | Saved | `200` | PASS | Days 1–4, version 2 |
| R2-01g | Repeat: the Thursday break 11:00–11:30 | Saved | `200` | PASS | Thursday breaks 12:00–13:00 and 11:00–11:30, version 3 |
| R2-01h | New bookings on the 20-minute grid: D (Wed 21 Oct 09:20–09:40, Ritika, found by "Ritika") and E (Mon 26 Oct 14:00–14:20, Devendra, found by "mishra"). Then add Saturday 09:00–13:00 | An edit that still fits saves | `200` | PASS | Saturday `[{09:00, 13:00}]`, version 4 |
| R2-01i | Extend Monday's afternoon from 13:00–17:00 to 13:00–18:00 | Saved | `200` | PASS | Monday 09:00–12:00 and 13:00–18:00, version 5 |
| R2-01j | `GET /slots` for each active booking of this doctor | D and E still sit on their slots | Both slots are BOOKED with their `appointmentId` | PASS | 2 active bookings from today on, 0 off the grid |
| R2-01k | Dr. Nisha Verma: untick Monday and save, then add Monday back through the editor with its two sessions and its break | Past and completed appointments don't block | Removing Monday: `200`. Putting it back: `200`, and Monday is identical to before. | PASS | Her Mondays hold 5 SCHEDULED appointments dated 19 Oct (the past) and 5 COMPLETED ones on 26 Oct, and nothing active ahead. While Monday was removed, her days were 2, 3, 4, 5, 6, 0. |
| R2-01l | Two admin windows on Dr. Malhotra's editor. One sets Saturday to end at 14:00, the other Tuesday at 17:40, and both press Save at the same moment. | The final schedule is valid | Both `200`. The final week has Saturday ending at 14:00 and Tuesday at **17:00**: the later save replaced the whole week, and the other admin's change was lost without a word. | PASS (valid); QUESTION Q-08 | Version 5 → 7, 0 bookings off the grid |
| R2-01m | 10 rounds through the API: an edit that fits and an edit that strands (slot length 30), sent at the same moment | The fitting edit saves and the stranding edit is refused, every time | The fitting edit got `200` in all 10 rounds and the stranding edit `409` in all 10 | PASS | Final slot length 20, 0 bookings off the grid |
| R2-01n | 10 rounds: two different edits that both fit, sent at the same moment | Both save; the result is one or the other, never a mix | `200`/`200` in every round. The final week was exactly one of the two each time (A 6 times, B 4 times). | PASS | Version +20, 0 bookings off the grid |
| R2-01o | 10 rounds: an edit that removes Wednesday afternoon races a booking of Wed 28 Oct 14:00 | Never both | Edit `409` and booking `422`: 5 rounds. Edit `200` and booking `422`: 2. Edit `409` and booking `201`: 3. Both succeeded: never. In 5 rounds both were refused, because each side's re-check saw the other's write and backed out (see the observations under Open questions). | PASS | 0 bookings off the grid afterwards |
| R2-01p | The H-06 and H-07 queries after all of this | 0 and 0 | Duplicate active doctor, date and start: 0 groups. Overlapping active appointments: 0 pairs. | PASS | 132 appointments not cancelled |

### R2-02: Indexes and sorting (Q-06)

| ID | Steps | Expected | Actual | Result | DB evidence |
| --- | --- | --- | --- | --- | --- |
| R2-02a | `listIndexes` on every collection; `explain("executionStats")` on all 37 list and search shapes (`qa/explain-all.mjs`, written to `qa/logs/explain-r2.json`) | No COLLSCAN, and sorting uses an index | **COLLSCAN: 0 of 37.** All 12 unfiltered lists (the ten appointment sorts, the patient list, the doctor list) read their page straight from an index: LIMIT ← FETCH ← IXSCAN, 20 keys for 20 rows. Their totals come from `estimatedDocumentCount`, and filtered totals from COUNT_SCAN or IXSCAN. **10 filtered shapes sort in memory after an index scan,** with at most 34 documents: the appointment list's patient name ("asha", "rao asha"), mobile prefix, and status sorted by patient name; and patient search by code, mobile prefix, exact mobile, "asha", "rao" and "rao asha". | PASS on COLLSCAN; QUESTION Q-09 on sorting | appointments: `uniq_active_doctor_slot`, `doctorId_1_date_1`, `status_1_date_1`, `departmentId_1_date_1`, `patientMobile_1`, `date_1_slotStart_1__id_1`, `patientNameLower_1__id_1`, `createdAt_1__id_1`, `doctorName_1__id_1`, `status_1__id_1`, `patientNameWords_1`. patients: `patientCode_1`, `mobile_1`, `nameLower_1__id_1`, `nameWords_1`. doctors: `userId_1`, `departmentId_1_name_1`, `name_1`, `specialization_1`. |
| R2-02b | The unfiltered list in the UI | The total shown is the real count | "Showing 1–20 of 163 appointments" | PASS | `meta.total` 163 (estimated), `countDocuments({})` 163 |
| R2-02c | The list sorted by each of its five fields in both directions, at 1280 px and at 768 px, through the control on screen. Page 1 and the last page are compared with an independent sort of the raw documents. | The same order, and the total each time | **First run: at 768 px no sort control was on screen at all, and at 1280 px there was no way to sort by Booked (BUG-12).** After the fix: all 20 combinations PASS. At 1280 px the headers were used for four fields and the "Sort by" choice for Booked; at 768 px, the choice for all ten. Page 1 (20 rows) and page 9 (3 rows) matched the independent order, the rows on screen matched the API's order, and every summary said 163. | FAIL (BUG-12), then PASS | 163 appointments |

### R2-03: Word search (Q-03)

Set-up (R2-03-setup, PASS): a new patient, "Anaïs Fernandes-Rao" (PAT-000052), was registered through the booking form. Stored `nameWords`: `["anais", "fernandes", "rao"]`.

Each term was typed into the booking form's "Find the patient" box and into the appointment list's "Patient name" box. Numbers went into the list's "Mobile" box, since its name box matches names only. "Independent" is a count over the raw documents, using the same rules written out again in the script. Every row is PASS.

| Term | Booking form: API total = independent; patients on screen | Appointment list: total = independent |
| --- | --- | --- |
| `Rao`, `rao` | 3 = 3: Anaïs Fernandes-Rao, Arjun Rao, Asha Rao | 31 = 31 |
| `Asha`, `Asha Rao`, `Rao Asha` | 1 = 1: Asha Rao | 23 = 23 each |
| `a r` | 5 = 5: Anaïs Fernandes-Rao, Arjun Rao, Asha Rao, Race Anita 10, Race Anita 8 | 35 = 35 |
| `PAT-000001`, `pat-000001`, `Pat-000001` | 1 = 1: Asha Rao | 0 = 0 (the name box doesn't take codes) |
| `9876543210`, `+91 98765 43210` | 2 = 2: Arjun Rao, Asha Rao | Mobile box: 30 = 30 |
| `98765` | 3 = 3: Arjun Rao, Asha Rao, Sunita Patil | Mobile box: 34 = 34 |
| `jose`, `Álvarez` (accent folding) | 1 = 1: José Álvarez | 6 = 6 |
| `आशा`, `राव` (Devanagari) | 1 = 1: श्रीमती आशा राव | 1 = 1 |
| `--` | 0: "No registered patient matches “--”." | 0 = 0: "No appointments match these filters". My script first expected the list to keep `--` out of the URL, as it does for the mobile box; it sends it, and the answer is 0. Expectation corrected and rerun. |
| `.*` | 0 = 0 | 0 = 0 |
| `<scr` | 1 = 1: the patient named `<script>alert('xss')</script>`, shown as text, with 0 live `script`/`img` elements | 5 = 5 |
| `Ritika`, `Sen` (middle word), `Gupta` | 1, 1 and 2 (with Anjali Gupta) | 5, 5 and 12 |
| `Nath` (middle word), `Mishra` | 1 = 1: Devendra Nath Mishra | 2 = 2 |
| `anais`, `fernandes`, `Fernandes Anaïs` | 1 = 1: Anaïs Fernandes-Rao | 1 = 1 |

| ID | Steps | Expected | Actual | Result | DB evidence |
| --- | --- | --- | --- | --- | --- |
| R2-03-backfill | `npm run backfill:name-words` on `emr_manual_qa` (through `qa/run-script.mjs`, URI never printed), then every word array compared with the words recomputed from the name | No empty or outdated arrays | Exit 0: 46 patients and 164 appointments checked, 0 updated, because they were filled when Q-03 landed and new documents get them from the schema | PASS | 0 of 46 patients and 0 of 164 appointments differ |
| R2-03-backfill-b | Remove the arrays of 3 patients, set a fourth to `["outdated"]`, and remove the arrays of 3 appointments. Run the backfill again. | It repairs exactly those | Updated: patients 4, appointments 3 | PASS | Afterwards 0 of 46 and 0 of 164 differ |
| R2-03-explain | `explain` on both searches | Index scans | Patients "rao asha", "आशा" and "jose": IXSCAN `nameWords_1`, 2 keys and 1 document each. Appointments "rao asha": IXSCAN `patientNameWords_1`, 24 keys and 23 documents; "राव" and "fernandes": 2 keys and 1 document. No COLLSCAN. | PASS | |

### R2-04: The "Is it one of these?" hint (Q-02)

| ID | Steps | Expected | Actual | Result | DB evidence |
| --- | --- | --- | --- | --- | --- |
| R2-04a | New-patient form at 1280 px and 375 px: type a mobile that one patient has | The hint lists that patient | Looked up `9811100010` once typing paused: "A registered patient has this mobile number", with Meena Pillai (PAT-000024) and one Choose button. The first run used `91234 00001`, which two patients share (José Álvarez from the first pass, and Ritika Sen Gupta, given the same number in R2-01). The hint correctly listed both. The test data was changed and the check rerun. | PASS | Only Meena Pillai has 9811100010 |
| R2-04b | Type `+91 98765-43210` at both widths | All the patients with it, and the page fits | "2 registered patients have this mobile number" (Arjun Rao, Asha Rao). At 375 px, after R2-04e, there were 3, each with its own Choose button. No sideways scroll. | PASS | `R2-04-mobile-hint-375.png` |
| R2-04c | Type a new number (9000077001), then a partial one (98765) | No hint | The new number was looked up and there was no hint. For the partial number no request was sent, and there was no hint. | PASS | 0 patients with 9000077001 |
| R2-04d | Type a name and `9876543210`, choose Asha Rao from the hint, then book | The form switches to that patient, and the booking is hers | "Existing patient" became checked and focused, and the patient card shows Asha Rao. `POST` 201 for PAT-000001. | PASS | Patients 46 → 46: no new record |
| R2-04e | Ignore the hint: register Kiran Rao with 98765 43210 | Registration still works | The hint was shown. `POST` 201, PAT-000053 Kiran Rao. | PASS | Patients 46 → 47; 3 patients now share 9876543210 |

### R2-05: The earlier fixes, one scenario each

| ID | Steps | Expected | Actual | Result | DB evidence |
| --- | --- | --- | --- | --- | --- |
| R2-05-BUG02 | `--` in the booking search; `--` in the list's Mobile box; `GET /appointments?mobile=--` and `/patients?search=--` | Nobody matches | "No registered patient matches “--”"; the list keeps `--` out of its URL; `400`; total 0 | PASS | |
| R2-05-BUG03 | Type "Asha", cut it back to "A", then empty the box | The results go | 0 results left after "A", and 0 after emptying | PASS | |
| R2-05-BUG04 | At 375, 768 and 1280 px: the dashboard, the scheduler, the list filtered to the 49-character name, and the booking form with that patient chosen | Nothing pokes out | Every measure is 0 at all three widths: page overflow, tiles wider than their cell, and row actions clipped | PASS | |
| R2-05-BUG05 | `POST /auth/logout` with a body nested 20,000 levels, then 30 | 400, then normal | `400` "Request body is nested too deeply"; `200` | PASS | |
| R2-05-BUG06 | A cross-site HTML form posts to `/auth/logout` from a signed-in window. Then curl, with a refresh cookie and no `Origin`, calls refresh and logout. | 403, the user stays signed in; curl works | Form POST: `403`. The cookie was kept, and after a reload the user was still on /appointments. curl refresh: `200` with a new cookie; curl logout: `200` with the cookie cleared. A new integration test (`af24a56`) covers requests without an `Origin`. | PASS | |
| R2-05-BUG07 | Log Rahul Menon out in the UI; refresh Dr. Meera Iyer's session, then present the old cookie again | Both audit entries carry the role | LOGOUT: role RECEPTIONIST. Refresh `200`, reused cookie `401`, then REFRESH_TOKEN_REUSE: role DOCTOR. | PASS | The 7 entries without a role all date from 18 Oct, before the fix. Every entry since has a role. |
| R2-05-BUG08 | Offline, open "Staff and schedules" before its code has loaded | "You're offline" | "You're offline. This page needs a connection to load. Reconnect, then reload the page." After reconnecting and reloading, the page opens. | PASS | |
| R2-05-BUG09 | Offline: choose Dr. Verma in the scheduler; reconnect. Then, offline, press "Book appointment" for an existing patient; reconnect and wait 6 s. | An error instead of an endless load; the grid returns by itself; the booking fails at once and never sends itself | "Couldn't load the slots. Can't reach the server…" after 4 s. The grid came back by itself after reconnecting. The booking alert said "Can't reach the server…", and 0 requests were sent after reconnecting. The first run chose Dr. Qureshi, who doesn't work on Tuesdays, so no grid could come back. The doctor was changed and the check rerun. | PASS | 0 appointments for that slot |

### R2-06: The full flow as each role

The windows were 1180 px wide, and another role's window kept the scheduler open, without reloading, to watch for live updates.

| ID | Steps | Expected | Actual | Result | DB evidence |
| --- | --- | --- | --- | --- | --- |
| R2-06-SA | Super Admin: log in; create Dr. Tara Bhatt (Pediatrics, 15 minutes); set the schedule (add Saturday 10:00–13:00); book a new patient (Ishita Kulkarni) and an existing one (Kiran Rao) for Wed 21 Oct; mark the visit arrived, then complete it; cancel the other; rebook its slot (Anjali Gupta). The receptionist's window watches. | Each step works, and the other window follows | Schedule `200` (6 days, 15 minutes). Bookings `201` (PAT-000054), `201` and `201`. ARRIVED, then COMPLETED, then CANCELLED. Each change was already on the receptionist's screen when checked, without a reload. | PASS | Doctor `6ad743a40e59a09eb5855612` |
| R2-06-R | Receptionist: check the menu and `/admin`; book a new patient (Farah Siddiqui) and an existing one (Ravi Kumar) for Thu 22 Oct; mark arrived; cancel; rebook (Sunita Patil). The admin's window watches. | Each step works; no staff page and no Complete | The menu is Dashboard, Scheduler, Book appointment and Appointments. `/admin` shows "You don't have access to this page". `201` three times. ARRIVED, with no Complete button for the receptionist, then CANCELLED. Every change appeared live. | PASS | |
| R2-06-D | Dr. Tara Bhatt: check the menu and `/appointments/new`; check her list; watch her Friday while the desk books and checks in Meena Pillai; complete the visit and write notes | Only her own appointments; live; can't book or cancel; notes only | The menu is Dashboard, Scheduler and Appointments. `/appointments/new` shows the 403 page. The list holds 6 = 6 in the DB. The booking and the arrival appeared live. There was no Cancel button. Complete gave COMPLETED. In the edit dialog the purpose was read-only, and the notes were saved. The first run counted rows "of other doctors" as rows without her name, but a doctor's list has no Doctor column. Rechecked from the API: 7 of 7 rows are hers (R2-06-D-own). | PASS | `notes` saved, `status` COMPLETED |
| R2-06-logout | Every role logs out, then opens the list again | Back on /login | All three were sent back to /login | PASS | LOGOUT audit entries with roles SUPER_ADMIN, RECEPTIONIST and DOCTOR |
| R2-06-console | Console and network across the three windows | Clean | No console error or warning, no failed request and no unexpected error response | PASS | |

### R2-07: The database after the retest (H-01 to H-09 again)

| ID | Check | Result | DB evidence |
| --- | --- | --- | --- |
| R2-07-H-01 | Every appointment has every field, including the new `patientNameWords`, with valid formats | PASS | 173 appointments, no problems |
| R2-07-H-02 | Copied fields and word arrays match their sources | PASS | 0 of 173 appointments differ (code, name, mobile, doctor name, words); 0 of 49 patients differ (`nameWords`, `nameLower`) |
| R2-07-H-03 | Audit entries per action, each with user, role, entity and time | PASS | ARRIVE 23, CANCEL 33, COMPLETE 9, CREATE appointment 173, doctor 6, patient 49, user 3, LOGIN 182, LOGIN_FAILED 22 (6 for unknown emails, which have no user), LOGOUT 10, REFRESH_TOKEN_REUSE 8, UPDATE appointment 6, UPDATE doctor (schedule edits) 48. The only entries without a role are 7 from before BUG-07's fix (18 Oct). |
| R2-07-H-03b | Audit entries agree with appointment states | PASS | 0 disagreements |
| R2-07-H-04 | Refresh tokens are stored as SHA-256 hashes only | PASS | 687 tokens, 0 raw JWTs, 0 malformed hashes |
| R2-07-H-05 | No orphan documents | PASS | 0 in all 12 relations |
| R2-07-H-06 | No duplicate active doctor, date and start | PASS | 0 groups |
| R2-07-H-07 | No overlapping active appointments | PASS | 0 pairs among 140 |
| R2-07-H-08 | Patient codes | INFO | 49 patients, unique, all in the `PAT-NNNNNN` format; counter at 55. The 6 missing codes were reserved by bookings that lost a race in the first pass (E-04). PAT-000047 also dates from 18 Oct. |
| R2-07-H-09 | Passwords | PASS | 10 users, all bcrypt cost 12 |

### R2 housekeeping

| ID | Check | Result | Evidence |
| --- | --- | --- | --- |
| R2-H-01 | The untracked root `package.json` and `package-lock.json` (P-01) | Done | Deleted; they were never committed |
| R2-H-02 | Requests without an `Origin` reach `/auth/refresh` and `/auth/logout` | PASS | curl in R2-05-BUG06, plus the integration tests in `af24a56`. They fail if the check refuses a missing `Origin`. The literal origin `null` is refused. |
| R2-H-03 | `server/.env` and `.env.example` are at their defaults | PASS | Both have `NODE_ENV=development`, `JWT_ACCESS_TTL_SECONDS=900` and `RATE_LIMIT_MAX=300`, and all their other settings match. `.env` was never committed (`git log --all` has no entry for it). |
| R2-H-04 | The whole git history searched for "mongodb+srv" and for real secrets | PASS | 0 matches in any commit for each of 14 real values: the Atlas user, password and host, both JWT secrets, the seed admin password and the 7 QA passwords. Only counts were printed. "mongodb+srv" appears only in the env validation regex, the `.env.example` placeholder and two lines of prose. |
| R2-H-05 | `qa/` and `qa-credentials.local.md` are gitignored | PASS | `.gitignore` lines 34 and 35 (`git check-ignore -v`) |
| R2-H-06 | At most 10 screenshots in git | Done | See [Screenshots](#screenshots) |
| R2-H-07 | API.md, DATABASE_DESIGN.md and decisions-notes cover the nested-body 400, the foreign-origin 403, the digit rule for mobile terms, the audit role, the new indexes and the schedule-edit 409 | Done | `2465c11` adds the audit role and the origin rule to API.md and DATABASE_DESIGN.md, and the digit rule to DATABASE_DESIGN.md. The rest landed with each change. |

## R3: Retest of the Q-08 change and the booking race

Run on Tuesday 20 Oct from about 19:15 IST, after the change for Q-08, against the same setup as R2: the real API and a production build, a visible Chromium, and the Atlas database `emr_manual_qa` with only its name changed. The scripts are `qa/r3-*.mjs`, with their results in `qa/logs/r3-*-results.json` and their screenshots in `qa/shots-r3/` (all gitignored).

### R3-01: Two admins saving one schedule (Q-08)

Dr. Tara Bhatt's week was at `scheduleVersion` 1 at the start. Two admin windows had her editor open, both loaded at version 1.

| ID | Steps | Expected | Actual | Result | DB evidence |
| --- | --- | --- | --- | --- | --- |
| R3-01a | Window 1: end Saturday at 12:00 instead of 13:00, and save | Saved | Sent `scheduleVersion` 1; `200` | PASS | Saturday ends 12:00; version 1 → 2 |
| R3-01b | Window 2, still showing the week as loaded: end Monday's second session at 16:30, and save | Refused, nothing lost, and the editor says so | Sent `scheduleVersion` 1. `409` "The schedule changed since you opened it. Reload to see the latest.", with `meta.code` `SCHEDULE_STALE` and `meta.scheduleVersion` 2. Above the Save button, fully in view: the message, "Reloading shows the schedule as it is saved now and drops the changes made here. Make them again, then save.", and a "Reload schedule" button. The form still shows window 2's change, and Saturday as it was loaded. | PASS | Unchanged: version 2, Saturday 12:00, Monday 17:00 |
| R3-01c | Window 2: press "Reload schedule", end Monday at 16:30 again, and save | The saved week appears, and the change then saves on top of it | The toast said "Reloaded Dr. Tara Bhatt's schedule as it is saved now". The form showed Saturday ending at 12:00 (window 1's save) and Monday at 17:00 (window 2's unsaved change dropped), with focus on "Slot length" and the alert gone. Saved again with version 2: `200`. | PASS | Saturday 12:00 **and** Monday 16:30; version 3 |
| R3-01d | 10 rounds through the API: two saves of the same version, each with a different Saturday, at the same moment | One saves and one is refused, every round | `200`/`409` in all 10 rounds. Each 409 gave the current version. The version went up by exactly 1 per round, and the week was the winner's, whole. | PASS | Version 3 → 13 |
| R3-01e | A save with an old version (10), and one with no version | 409, and 400 | `409` with `meta.scheduleVersion` 13. `400`: `body.scheduleVersion` "Send the scheduleVersion of the schedule being changed". | PASS | Version unchanged at 13 |
| R3-01f | Console and network in both windows | Clean | Nothing, apart from window 2's expected 409 | PASS | |

### R3-02: A schedule edit racing a booking, and transactions under contention

Rerun after the change that makes every refusal in this race a 409 with a retry message, and runs a transaction once more after a transient error. Dr. Kabir Malhotra again, through the API. Every response was checked for a status below 500 and a readable message, and the API log for the run was scanned.

| ID | Steps | Expected | Actual | Result | DB evidence |
| --- | --- | --- | --- | --- | --- |
| R3-02a | 20 rounds: an edit that removes Wednesday afternoon (sent with the current version) and a booking of Wed 28 Oct 14:00, at the same moment. The edit is undone or the booking cancelled after each round. | Never both saved; every refusal a clean 409 with a retry message | Edit `409` and booking `409`: 17 rounds. Edit `200` and booking `409`: 2. Edit `409` and booking `201`: 1. Both saved: never. No response was 5xx or lacked a message. The refusals: `409 APPOINTMENTS_STRANDED` "A booking was made for a time this change removes while it was being saved. Nothing was changed; check it, then try again." and `409 SCHEDULE_CHANGED` "The doctor's schedule changed while this was being booked. Check the free times and try again." When both are fired together, both usually back out; either can be sent again. | PASS | 0 active bookings left at Wed 14:00 |
| R3-02b | 10 new-patient bookings of Thu 29 Oct 10:00 at the same moment | One booking and one patient; the rest refused cleanly | `201` once, `409 Slot already booked` nine times | PASS | 1 active appointment in the slot; 1 new patient |
| R3-02c | The API log for R3-02a and R3-02b | No error, no 500 | 55 requests: 0 ERROR lines, 0 5xx, 46 409s | PASS | |
| R3-02d | After retries were made visible in the log: 3 more rounds of 10 new-patient bookings of one slot (Thu 10:20, 10:40, 13:00) | One booking per slot; every refusal a clean 409 | Each round: `201` once and `409` nine times. The refusals were "Slot already booked" and, twice, "This could not be saved because of a change made at the same moment. Try again.". The log shows 22 transactions that lost a write conflict and ran once more, and 2 that lost again and answered that 409. 0 ERROR lines, 0 5xx. | PASS | 1 active appointment and 1 new patient per slot |

## Bugs

BUG-01 to BUG-09 were found in the first pass, and BUG-10 to BUG-12 in the R2 retest. All twelve are fixed, each in its own commit with a regression test. Each fix was retested against the running app ("Retest"), and each regression test was confirmed to fail without its fix.

| Bug | Severity | Where | What was wrong (root cause) | Fix | Regression test | Retest |
| --- | --- | --- | --- | --- | --- | --- |
| BUG-01 | Low | Client, admin | On Windows, the "Staff and schedules" tab bar showed a vertical scrollbar (A-05). The tab list scrolls sideways (`overflow-x: auto`, which makes `overflow-y` auto too), and the tabs overlapped its bottom border with `-mb-px`, so it overflowed by 1 px. Overlay scrollbars on macOS hide this. | `691c8bc` the bottom line is an inset shadow; no negative margin | `e2e/admin.spec.ts`: the tab list has no vertical overflow | R-01 PASS (`BUG-01-tabs-after.png`) |
| BUG-02 | Low | API and client | A search of separators alone (`--`, `()`, `.`) listed every patient, and `?mobile=--` every appointment (B-S-18). The term was read as a mobile number, and stripping the separators left an empty prefix. | `1e72f46` a mobile term needs a digit: patient search treats the term as a name, the list filter answers 400, and the client keeps such text out of the URL | `patients.test.ts`, `appointments.test.ts`, `useTextFilters.test.ts` | R-02 PASS |
| BUG-03 | Low–medium | Client, booking | After the "Find the patient" box was emptied or cut to one character, the last results stayed on screen and could still be picked (B-S-19). `placeholderData: keepPreviousData` also applied while the search was switched off (`skipToken`). | `5c69f35` previous results are kept only while a search runs | `PatientSearch.test.tsx` | R-03 PASS |
| BUG-04 | **Medium–high** | Client, list, scheduler, dashboard, booking | Long words (a name without spaces, tests joined by "/") broke layouts (B-H-02, B-H-04, I-08). With a realistic 49-character name: the list's **Arrived and Cancel buttons were pushed 238 px out of view at 1280 px**; slot tiles grew into their neighbours; the dashboard (241 px) and booking form (152 px) scrolled sideways on a phone. Causes: auto table layout sizing a column to its longest word inside an `overflow-hidden` card; a tile with `min-width: auto` in an implicit `auto` grid track; single-column grids without a column template. | `60bb736` `wrap-anywhere` on table cells, `min-w-0` on tiles, explicit `grid-cols-1` | `e2e/responsive.spec.ts` "long words stay inside their tiles, rows and forms" at 375, 768 and 1280 px | LT-375/768/1280 PASS, every measure 0 (`LT-after-*.png`) |
| BUG-05 | Medium | API | A 40 KB JSON body of 20,000 nested arrays got **500** on any endpoint, before authentication (F-09a): `RangeError: Maximum call stack size exceeded` in the recursive `stripUnsafeKeys`. A cheap way to fill the error log, though the process survived. | `e426bc9` bodies nested more than 32 levels get 400 "Request body is nested too deeply" | `sanitize-input.test.ts`, `app.test.ts` | R-06 PASS |
| BUG-06 | Medium | API, auth | **Any website could sign clinic staff out** (F-13b). A plain HTML form posted to `/api/v1/auth/logout` arrived without the cookie (SameSite=Strict), but the response always cleared the cookie, and a top-level navigation applies that. `/auth/refresh` did the same on failure. | `f1d2eb2` the cookie is cleared only when the request carried it; `/auth/refresh` and `/auth/logout` refuse a foreign `Origin` with 403, which also covers `REFRESH_COOKIE_SAMESITE=none` | `auth.test.ts` (foreign origin, no cookie, own origin) | R-07a, R-07b PASS: the form POST gets 403 and the user stays signed in |
| BUG-07 | Low | API, audit | LOGOUT (2) and REFRESH_TOKEN_REUSE (5) entries had no role (H-03); the brief asks for user, role, action, entity and time on every entry | `5f10c59` the role is looked up for both | `auth.test.ts` | R-08 PASS |
| BUG-08 | Low | Client | Offline, opening a page whose code hadn't loaded yet said "A newer version is available. The app was updated while this tab was open" (I-07a) | `a6d3f56` "You're offline. … Reconnect, then reload the page." when `navigator.onLine` is false | `ErrorFallback.test.tsx` | I-07a PASS |
| BUG-09 | Medium | Client | Offline, nothing told the user (I-07b): TanStack Query paused requests (`networkMode: 'online'`), so the scheduler showed skeletons for as long as it lasted, the list showed old rows under a new filter, and **a booking would have sent itself whenever the connection came back** | `4400431` `networkMode: 'always'` for queries and mutations, so they fail into the existing error states, plus an explicit `refetchOnReconnect: true` (with `'always'` it defaults to off) | `query-client.test.ts`: a query and a mutation made offline, and the reload on reconnect | I-07b PASS: "Couldn't load the slots … Try again", reload on reconnect |
| BUG-10 | Medium | Client, admin | When a schedule change was refused (R2-01a), the list of bookings it would strand appeared at the top of the editor, about 1,500 px above the Save button just pressed, so a sighted user saw nothing happen. The create-doctor form put its general error in the same place. Both forms are taller than a screen, and each placed its form-level alert first. | `812f136` both alerts sit directly above their button, and `useRevealOnChange` scrolls them fully into view with the button still visible. The booking form's slot problem uses the same hook. | `e2e/admin.spec.ts`: the refusal, and a 500 on adding a doctor, are fully in the viewport | R2-01a/b/c rerun at 1280 and 375 px PASS (`R2-01-schedule-change-refused.png`) |
| BUG-11 | Medium | Client, admin | At 375 px every time in the schedule editor lost its last digit: "09:00" read "09:0", so the minutes couldn't be read on a phone (found while checking R2-01's screenshots). Each range is one row (start, "to", end, remove), which left each box 88 to 95 px, and a box needs 104 px to show the time beside Chromium's clock button. The page-overflow checks missed it, because the text is clipped inside the box. | `fcab9c5` below an 18rem container, a range's name and remove button take a line of their own, and the times share the full width: 112 px each at 375 px | `e2e/responsive.spec.ts` "the schedule editor shows each time in full" at 375, 768 and 1280 px | R2: 112 px boxes and 0 overflow at 375 px, in the editor and the create-doctor form (`R2-BUG11-times-clipped-375.png`, `R2-BUG11-times-in-full-375.png`) |
| BUG-12 | Medium | Client, list | At 768 px, and from 1024 px where the sidebar returns, the appointment list had **no sort control on screen** (R2-02c). Below a 48rem container the table shows cards with its headers visually hidden, while the "Sort by" choice was hidden from 768 px by a screen-width breakpoint (`md`). Sorting by Booked needed a screen about 1,500 px wide, since that column appears at a 72rem container. The choice also offered only 6 of the 10 sorts. | `545795c` the choice follows the table's container, shows until every sortable header fits, and offers all 10 sorts | `e2e/responsive.spec.ts` "every sort can be chosen" at 375, 768 and 1280 px | R2-02c: 20 of 20 PASS at 1280 and 768 px (`R2-BUG12-no-sort-control-768.png`, `R2-BUG12-sort-choice-768.png`) |

In the first pass, server tests went from 174 to 184 and client unit tests to 102, plus the two end-to-end changes above. With the Q changes and the R2 fixes, the totals are 215 server tests, 110 client tests and 91 end-to-end tests.

## Open questions

These are ambiguous against `ASSESSMENT.md`, or behaviour you may want different. Q-01 to Q-07 come from the first pass and Q-08 and Q-09 from the R2 retest. The Status column says what was done with each.

| Q | Behaviour seen | Options | Status |
| --- | --- | --- | --- |
| Q-01 | **A doctor with no working days is accepted** (A-15): every day switched off, 201, no warning. The brief lists "no working days" among invalid schedules. API.md documents `[]` as allowed, for example for a doctor on leave. | (a) Keep, and add a confirmation in the UI. (b) Require one working day when creating a doctor, but allow `[]` when editing (leave). (c) Always require one. | **Kept** (a, without the confirmation): README "Assumptions" and "Known limitations" (`aed025d`) |
| Q-02 | **Duplicate patients.** A new patient with an existing mobile is registered silently (B-UI-16: Arjun Rao shares Asha Rao's number). Two identical registrations in parallel give two records (E-04a). Mobiles are deliberately not unique, because families share phones. | (a) Keep. (b) When the typed mobile matches registered patients, show them in the new-patient form as "Is it one of these?" without blocking. (c) Refuse exact duplicates (same name, mobile and date of birth) with 409 and offer the existing record. | **Resolved** with (b): `224107d`. Retested in R2-04. |
| Q-03 | **Name search matches only the start of the full name** (B-S-10): "Rao" finds neither Asha Rao nor Arjun Rao. Patient IDs must be typed in full (`PAT-1` finds nothing), and accents aren't folded (`jose` misses José). Documented in API.md. | (a) Keep. (b) Match the start of any word: store the name's words in an indexed array and search `/^rao/` there; still an index scan. (c) Atlas Search. | **Resolved** with (b), for patient search and the list's patient filter, with a backfill script: `aa70eb2`. Retested in R2-03. |
| Q-04 | **No booking horizon** (B-X-55): a slot in 2099 passes every slot rule | (a) Keep. (b) A configurable horizon (for example 90 days) answered with 422. | **Kept** (a): README "Known limitations" (`aed025d`) |
| Q-05 | **Operator-looking query parameters get 200, not 400** (F-11b). `?search[$gt]=` is a literal unknown key that the schema ignores, so the request runs without that filter. Nothing is injected, but the brief expects 400. JSON bodies with operators do get 400 (F-11a). | (a) Keep: unknown parameters are ignored, as documented. (b) Strict query schemas: unknown or bracketed parameters get 400. | **Kept** (a): README "Assumptions" and "Known limitations", and API.md's input rules (`aed025d`) |
| Q-06 | **COLLSCAN on lists without a filter** (G-06): the default appointment list, the sorts by patient name and by `createdAt`, and the patient list without a term. Harmless at this size; DATABASE_DESIGN.md §10 measured 160 ms at 43,000 appointments. | (a) Keep for clinic scale. (b) Apply the documented index changes (`{date, slotStart, _id}`, `{patientNameLower, _id}`, `{nameLower, _id}`), add `{createdAt, _id}`, and use `estimatedDocumentCount` for unfiltered totals. | **Resolved** with (b): `ccb6a9f`, then 0 COLLSCAN in R2-02. Sorting of filtered searches: see Q-09. |
| Q-07 | **Schedule edits with booked appointments** (A-20). Booked appointments never move, are never flagged, and nothing can be undone safely. An appointment off the new grid disappears from the day sheet, though it stays in the list. Slots overlapping a booked visit are offered, so a doctor can end up with **two patients at the same time** (A-20b). Removing a day strands its bookings. The double-booking index only compares start times. | (a) Keep, and document it (the current state). (b) Refuse a change that strands active future appointments: 409, listing them. (c) Allow it, but list the affected appointments for rebooking and show off-grid bookings on the day sheet. (d) Work out availability by time overlap, so a slot overlapping any active appointment is BOOKED, and check the overlap in the booking transaction. That closes the overlap however the grid changes. | **Resolved** with (b): `ddb27d1`, including a race between an edit and a booking. Retested in R2-01, which found BUG-10. |
| Q-08 | **Two admins saving one schedule at once: the later save wins** (R2-01l). Both editors were opened on the same week, and each changed a different day. The second save replaced the whole week, so the first admin's change was lost without a word, although both saw "Schedule saved". The result is always a valid schedule that strands no booking (R2-01l, R2-01n). | (a) Keep: one Super Admin usually manages schedules, and the editor reloads after a save. (b) Optimistic concurrency: the editor sends the `scheduleVersion` it loaded, and a mismatch gets 409 "This schedule was changed by someone else. Reload it, then make your change again", shown the way the stranded-booking refusal is. | **Resolved** with (b): `fix: refuse stale schedule saves`. A save sends the version it loaded; an outdated one gets 409 and the editor offers "Reload schedule". Retested in R3-01. |
| Q-09 | **Filtered searches sort in memory** (R2-02a). 10 of the 37 shapes find their rows through an index and then sort the matches in memory (at most 34 documents here): the patient word, mobile and code searches, and the list filtered by status but sorted by patient name. Every unfiltered list and every sort of the full list reads its order from an index. A prefix match is a range on one index, so that index can't also supply another field's order. | (a) Keep: a search returns few rows, and MongoDB's in-memory sort limit (100 MB) is far away. (b) Add compound indexes for the equality filters with each sort, for example `{status, patientNameLower, _id}`: up to 5 more per filter, each slowing writes. (c) For broad terms (one letter), let the query walk the sort's index and filter as it goes: cheaper for broad terms, worse for selective ones. | **Kept** (a): a search sorts a few dozen matches at most, so the in-memory sort costs nothing measurable. Recorded in API.md §7, DATABASE_DESIGN.md §10 and the README's Known limitations. |

Smaller observations, not bugs:
- When a schedule edit and a booking of a slot it removes arrive at the same moment, both can be refused (5 of 10 rounds in R2-01o): each side's re-check sees the other's write and backs out. Both never succeed. The receptionist then sees "This time is not a slot in the doctor's schedule", and the admin a 409 listing a booking that was just withdrawn; trying again succeeds.
- The schedule editor offers slot lengths of 5, 10, 15, 20, 30, 45 and 60 minutes only, while the API accepts 5 to 240. A 25-minute doctor can only be set up through the API (A-13).
- Arrival can be marked on any date, including before the appointment's day (documented judgment call).
- A reload in the middle of the booking form loses what was typed (I-04), because nothing is kept in browser storage. The doctor, day and slot survive in the URL.
- A 02:20 session is labelled "Morning".
- The rate limits count per IP: with every clinic PC behind one NAT address, 10 mistyped passwords lock everyone out for 15 minutes (F-06).
- An expired access token produces a burst of 401s (one per parallel request) before the single refresh (F-01).
- React Router keeps scroll positions in sessionStorage (`react-router-scroll-positions`); no token or patient data is stored there (F-12).

## Final regression runs

Run on Tuesday 20 Oct at about 16:50 IST, after the Q changes and all twelve fixes:

| Gate | Server | Client |
| --- | --- | --- |
| Prettier (`format:check`) | clean | clean |
| ESLint (`lint`) | clean | clean |
| `tsc --noEmit` (`typecheck`) | clean | clean (app, tool configs and e2e) |
| Unit and integration tests | **215 passed** (29 files); coverage 93.09% of statements, 93.03% of lines | **110 passed** (22 files) |
| Production build | clean | clean |
| End-to-end (`npm run e2e`) | | **91 passed** (5.5 min), on the first run |

The earlier final runs, after the first nine fixes:

| Gate | Server | Client |
| --- | --- | --- |
| Prettier (`format:check`) | clean | clean |
| ESLint (`lint`) | clean | clean |
| `tsc --noEmit` (`typecheck`) | clean | clean (app, tool configs and e2e) |
| Unit and integration tests | **184 passed** (25 files); coverage 92.8% of statements, 92.76% of lines | **102 passed** (20 files) |
| Production build | clean | clean |
| End-to-end (`npm run e2e`) | | **82 passed** (4.7 min) |

The first e2e run had one timeout (81 passed): the axe-core test "the front desk's pages and dialogs" ran 14 scans in its 60-second budget while the server's coverage run used the same machine. On its own the test passed with no axe violations, and the whole suite then passed on a quiet machine. Every fix commit's changed files were also checked against Prettier at that commit.

## Screenshots

Ten are kept in [`docs/manual-qa/`](manual-qa/). The rest of the run's screenshots are outside git, in the gitignored `qa/manual-qa-archive/` (first pass) and `qa/shots-r2/` (R2).

| File | Shows |
| --- | --- |
| `E-01-round1-loser.png` | Double booking: the window that lost the race is told, and sees the slot taken (E-01) |
| `LT-before-1280-list.png` | BUG-04 before the fix: a 49-character name pushes the row's actions out of the list at 1280 px |
| `LT-after-1280-list.png` | BUG-04 after the fix |
| `A-20a-grid-after-20-min.png` | Q-07 before the change: a slot-length change left booked visits off the grid and offered overlapping slots |
| `R2-01-schedule-change-refused.png` | Q-07 after the change (and BUG-10's fix): the refusal lists the bookings, next to the Save button |
| `R2-BUG11-times-clipped-375.png` | BUG-11 before the fix: "09:0" in the schedule editor at 375 px |
| `R2-BUG11-times-in-full-375.png` | BUG-11 after the fix |
| `R2-BUG12-no-sort-control-768.png` | BUG-12 before the fix: the list at 768 px, with no sort control |
| `R2-BUG12-sort-choice-768.png` | BUG-12 after the fix: the "Sort by" choice at 768 px |
| `R2-04-mobile-hint-375.png` | Q-02: "Is it one of these?" for a number three patients share, at 375 px |

## Not tested

- Browsers other than Chromium (Firefox, Safari, real phones), and screen readers such as NVDA and JAWS. Accessibility was only checked through roles, names and live regions.
- The native time pickers of real phones. BUG-11's 104 px was measured in desktop Chromium, whose time box shows a clock button.
- `GET /health` answering 503 when the database is down: the Atlas cluster couldn't be made unreachable from here.
- More than one API instance (Socket.IO across instances), and running behind a proxy (`TRUST_PROXY_HOPS`).
- `REFRESH_COOKIE_SAMESITE=none` deployments (only covered by the new integration test of the origin check).
- The TTL index actually deleting a refresh token: that needs 7 days. The index itself was verified (P-03).
- An open app crossing midnight on the clinic's clock: the date changed between the two test sessions, not under an open screen.
- Performance at large volume: the plans in G-06 come from 149 appointments, and those in R2-02a from 163. The before-and-after comparison in DATABASE_DESIGN.md §10 used a local MongoDB with 43,260 generated appointments, not this database.
- Daylight saving: Asia/Kolkata has none.
