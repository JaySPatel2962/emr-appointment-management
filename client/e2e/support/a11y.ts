import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { expect } from './fixtures';

// WCAG 2.2 levels A and AA, plus axe's best practices.
const RULE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/** Runs axe-core on the page as it is now and fails on any violation, listing where. */
export const expectAccessible = async (page: Page, state: string): Promise<void> => {
  const { violations } = await new AxeBuilder({ page }).withTags(RULE_TAGS).analyze();
  const found = violations.map((violation) => {
    const where = violation.nodes
      .slice(0, 3)
      .map((node) => node.target.join(' '))
      .join('; ');
    return `${violation.id} (${violation.impact ?? 'no impact'}): ${violation.help}, at ${where}`;
  });
  expect(found, `accessibility problems on ${state}`).toEqual([]);
};
