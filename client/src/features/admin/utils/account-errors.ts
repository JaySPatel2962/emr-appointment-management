import type { UseFormSetError } from 'react-hook-form';

import { HTTP_STATUS } from '@/constants/http';
import type { AccountFormValues } from '@/features/admin/schemas';
import { hasStatus } from '@/services/api-error';
import { applyServerFieldErrors } from '@/utils/form-errors';

const ACCOUNT_FIELDS = ['name', 'email', 'password'];

/**
 * Puts an account error where it belongs: a taken email (409) on the email field, a 400's
 * field errors on their fields. Returns whether anything was shown.
 */
export const applyAccountErrors = (
  error: unknown,
  setError: UseFormSetError<AccountFormValues>,
): boolean => {
  if (hasStatus(error, HTTP_STATUS.CONFLICT)) {
    setError(
      'email',
      { type: 'server', message: 'Another account already uses this email' },
      { shouldFocus: true },
    );
    return true;
  }
  return applyServerFieldErrors(error, setError, (field) => {
    const name = field.replace(/^body\./, '');
    return ACCOUNT_FIELDS.includes(name) ? name : null;
  });
};
