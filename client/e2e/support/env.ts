import type { PatientKey } from './seed-data';

// Global setup hands the tests what it started and seeded through one environment variable:
// Playwright's worker processes inherit the runner's environment.

const STACK_VARIABLE = 'EMR_E2E_STACK';

export interface SeededDoctor {
  id: string;
  name: string;
  departmentId: string;
  departmentName: string;
}

export interface SeededPatient {
  id: string;
  code: string;
  name: string;
  mobile: string;
}

export interface SeedInfo {
  /** Department ids by name. */
  departments: Record<string, string>;
  doctors: { kavya: SeededDoctor; arjun: SeededDoctor };
  patients: Record<PatientKey, SeededPatient>;
  /** The appointment list's data: Dr. Mehta's day, then Dr. Rao's the day after. */
  listDays: { kavya: string; arjun: string };
}

export interface StackInfo {
  apiUrl: string;
  /** The test API's own JWT secret, generated for this run, to forge an expired token. */
  accessTokenSecret: string;
  seed: SeedInfo;
}

export const publishStack = (stack: StackInfo): void => {
  process.env[STACK_VARIABLE] = JSON.stringify(stack);
};

let cached: StackInfo | null = null;

/** Read on first use: the stack exists only once global setup has run. */
export const stackInfo = (): StackInfo => {
  if (cached === null) {
    const raw = process.env[STACK_VARIABLE];
    if (raw === undefined) {
      throw new Error('The end-to-end stack is not running. Start the tests with npm run e2e.');
    }
    cached = JSON.parse(raw) as StackInfo;
  }
  return cached;
};

export const seedInfo = (): SeedInfo => stackInfo().seed;
