import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { HTTP_STATUS } from '@/constants/http';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { loginSchema } from '@/features/auth/schemas';
import type { LoginCredentials, LoginFormValues } from '@/features/auth/schemas';
import { ApiError } from '@/services/api-error';

const TOO_MANY_ATTEMPTS =
  'Too many failed attempts from this device. Wait 15 minutes, then try again.';

const loginErrorMessage = (error: Error): string => {
  if (error instanceof ApiError && error.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    return TOO_MANY_ATTEMPTS;
  }
  return error instanceof ApiError ? error.message : 'Something went wrong. Try again.';
};

/**
 * The login form's state and submit. Success needs no navigation here: the new session makes
 * <PublicOnlyRoute> send the user on to the page they came for.
 */
export const useLoginForm = () => {
  const { signIn } = useAuth();
  const form = useForm<LoginFormValues, unknown, LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: signIn,
    onError: () => {
      form.resetField('password');
      form.setFocus('password');
    },
  });

  const onSubmit = form.handleSubmit((credentials) => {
    mutate(credentials);
  });

  return {
    form,
    onSubmit,
    submitting: isPending,
    errorMessage: error ? loginErrorMessage(error) : null,
  };
};
