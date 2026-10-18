import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/services/api-error';

/** `body.newPatient.mobile` -> `newPatient.mobile`; anything outside the body has no field. */
const bodyFieldPath = (field: string): string | null =>
  field.startsWith('body.') ? field.slice('body.'.length) : null;

/**
 * Puts a 400's field errors (`meta.errors`) on the form's own fields, so each message appears
 * next to the input it is about. `toPath` maps a server path to a form path, or null to skip it.
 * Returns whether any field got an error, so the caller can show a general message otherwise.
 */
export const applyServerFieldErrors = <T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  toPath: (field: string) => string | null = bodyFieldPath,
): boolean => {
  if (!(error instanceof ApiError)) {
    return false;
  }
  let applied = false;
  for (const { field, message } of error.fieldErrors) {
    const path = toPath(field);
    if (path !== null) {
      // The server's paths are dynamic strings, so they can't be checked against the form's type.
      setError(path as Path<T>, { type: 'server', message });
      applied = true;
    }
  }
  return applied;
};

/** The message to show for a failed mutation. */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Try again.';

/** A 400 whose problems are already shown next to their fields needs no general message. */
export const hasFieldErrors = (error: unknown): boolean =>
  error instanceof ApiError && error.fieldErrors.length > 0;
