import type { UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import type { AccountFormOutput, AccountFormValues } from '@/features/admin/schemas';

export interface AccountFieldsProps {
  form: UseFormReturn<AccountFormValues, unknown, AccountFormOutput>;
}

/** The login a new staff member gets: their name, email and first password. */
export const AccountFields = ({ form }: AccountFieldsProps) => {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <>
      <FormField label="Full name" error={errors.name?.message}>
        {(control) => <Input {...control} {...register('name')} autoComplete="off" />}
      </FormField>
      <FormField label="Email" hint="They log in with it" error={errors.email?.message}>
        {(control) => (
          <Input
            {...control}
            {...register('email')}
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>
      <FormField
        label="First password"
        hint="At least 8 characters, with a letter and a number. Give it to them in person."
        error={errors.password?.message}
      >
        {(control) => (
          <PasswordInput {...control} {...register('password')} autoComplete="new-password" />
        )}
      </FormField>
    </>
  );
};
