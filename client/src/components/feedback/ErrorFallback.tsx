import { TriangleAlert } from 'lucide-react';

import type { ErrorFallbackProps } from '@/components/feedback/ErrorBoundary';
import { Button } from '@/components/ui/Button';
import { buttonClasses } from '@/components/ui/button-styles';
import { EmptyState } from '@/components/ui/EmptyState';

// A deploy replaces the old JavaScript chunks; a tab opened before it can't load the new pages.
const isChunkLoadError = (error: Error): boolean =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message,
  );

const reloadPage = (): void => {
  window.location.reload();
};

export interface ErrorFallbackViewProps extends ErrorFallbackProps {
  /** Where "Go to the dashboard" leads: a plain link, so it works outside the router too. */
  homeHref?: string | undefined;
}

export const ErrorFallback = ({ error, reset, homeHref = '/' }: ErrorFallbackViewProps) => {
  const outdated = isChunkLoadError(error);

  return (
    <div role="alert">
      <EmptyState
        icon={TriangleAlert}
        headingLevel={1}
        title={outdated ? 'A newer version is available' : "This page didn't load"}
        description={
          outdated
            ? 'The app was updated while this tab was open. Reload to get the latest version.'
            : 'Something unexpected happened while showing this page. Try again, or go back to the dashboard.'
        }
        action={
          <>
            {outdated ? (
              <Button onClick={reloadPage}>Reload the page</Button>
            ) : (
              <Button onClick={reset}>Try again</Button>
            )}
            <a href={homeHref} className={buttonClasses({ variant: 'secondary' })}>
              Go to the dashboard
            </a>
          </>
        }
      />
    </div>
  );
};
