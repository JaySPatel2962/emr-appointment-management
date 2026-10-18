import { useMutation } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/hooks/useAuth';

/** Logs out: the server revokes the refresh token, and every tab of this app signs out. */
export const useLogout = () => {
  const { signOut } = useAuth();
  const { mutate, isPending } = useMutation({ mutationFn: signOut });

  return {
    logout: () => {
      mutate();
    },
    loggingOut: isPending,
  };
};
