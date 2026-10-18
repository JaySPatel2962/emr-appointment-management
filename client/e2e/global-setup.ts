import { E2E_API_URL } from './support/config';
import { publishStack } from './support/env';
import { seedClinic } from './support/seed';
import { startStack } from './support/stack';

/**
 * Before the first test: a fresh database, the API, and the clinic's seed data. Playwright calls
 * the returned function after the last test, which stops the API and drops the database.
 */
const globalSetup = async (): Promise<() => Promise<void>> => {
  const stack = await startStack();
  try {
    const seed = await seedClinic(E2E_API_URL);
    publishStack({ apiUrl: E2E_API_URL, accessTokenSecret: stack.accessTokenSecret, seed });
  } catch (error) {
    await stack.stop();
    throw error;
  }
  return stack.stop;
};

export default globalSetup;
