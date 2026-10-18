import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { RouterProvider } from 'react-router/dom';

import { router } from '@/app/router';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { Toaster } from '@/components/feedback/Toaster';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { createQueryClient } from '@/services/query-client';

export const App = () => {
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary
      fallback={(props) => (
        <main className="min-h-dvh px-4 py-16">
          <ErrorFallback {...props} />
        </main>
      )}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
      <Toaster />
    </ErrorBoundary>
  );
};
