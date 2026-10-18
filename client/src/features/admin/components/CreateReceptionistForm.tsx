import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { HTTP_STATUS } from '@/constants/http';
import { AccountFields } from '@/features/admin/components/AccountFields';
import { useCreateReceptionist } from '@/features/admin/hooks/useAdminMutations';
import { accountSchema } from '@/features/admin/schemas';
import type { AccountFormOutput, AccountFormValues } from '@/features/admin/schemas';
import { applyAccountErrors } from '@/features/admin/utils/account-errors';
import { hasStatus } from '@/services/api-error';
import { errorMessage, hasFieldErrors } from '@/utils/form-errors';

const EMPTY_ACCOUNT: AccountFormValues = { name: '', email: '', password: '' };

export const CreateReceptionistForm = () => {
  const form = useForm<AccountFormValues, unknown, AccountFormOutput>({
    resolver: zodResolver(accountSchema),
    defaultValues: EMPTY_ACCOUNT,
    mode: 'onTouched',
  });
  const { mutate, isPending, error, reset } = useCreateReceptionist();
  // A taken email or a field problem is shown next to its field instead.
  const generalError =
    error && !hasStatus(error, HTTP_STATUS.CONFLICT) && !hasFieldErrors(error) ? error : null;

  const onSubmit = form.handleSubmit((values) => {
    mutate(values, {
      onSuccess: () => {
        form.reset();
        reset();
      },
      onError: (failure) => {
        applyAccountErrors(failure, form.setError);
      },
    });
  });

  return (
    <Panel
      title="Add a receptionist"
      description="Receptionists search patients, book appointments, check patients in and update visits."
    >
      <form noValidate onSubmit={onSubmit} className="flex max-w-xl flex-col gap-5">
        {generalError ? <Alert tone="error">{errorMessage(generalError)}</Alert> : null}
        <AccountFields form={form} />
        <div>
          <Button type="submit" loading={isPending}>
            Add receptionist
          </Button>
        </div>
      </form>
    </Panel>
  );
};
