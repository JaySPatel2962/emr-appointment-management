import type { z } from 'zod';

/** One line per invalid setting: its name and the problem, never its value. */
export const describeConfigIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `  - ${issue.path.map(String).join('.')}: ${issue.message}`)
    .join('\n');
