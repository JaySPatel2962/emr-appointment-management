import { isRouteErrorResponse, useRouteError } from 'react-router';

import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { ErrorFallback } from '@/components/feedback/ErrorFallback';
import { HTTP_STATUS } from '@/constants/http';

const reload = (): void => {
  window.location.reload();
};

/** The router's last line of defence, for errors that escape every page's own boundary. */
export const RouteErrorPage = () => {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === HTTP_STATUS.NOT_FOUND) {
    return <NotFoundPage />;
  }
  return (
    <main className="min-h-dvh bg-canvas px-4 py-16">
      <ErrorFallback
        error={error instanceof Error ? error : new Error('Something went wrong')}
        reset={reload}
      />
    </main>
  );
};
