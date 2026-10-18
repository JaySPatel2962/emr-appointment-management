import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useLoginForm } from '@/features/auth/hooks/useLoginForm';

export const LoginForm = () => {
  const { form, onSubmit, submitting, errorMessage } = useLoginForm();
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {errorMessage ? <Alert tone="error">{errorMessage}</Alert> : null}

      <FormField label="Email" error={errors.email?.message}>
        {(control) => (
          <Input
            {...control}
            {...register('email')}
            type="email"
            inputMode="email"
            autoComplete="username"
            spellCheck={false}
          />
        )}
      </FormField>

      <FormField label="Password" error={errors.password?.message}>
        {(control) => (
          <PasswordInput {...control} {...register('password')} autoComplete="current-password" />
        )}
      </FormField>

      <Button type="submit" fullWidth loading={submitting}>
        Log in
      </Button>
    </form>
  );
};
