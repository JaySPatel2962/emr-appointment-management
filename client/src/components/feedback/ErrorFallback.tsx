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

// Why a page's code didn't load. Offline, a missing chunk says nothing about a new version.
const chunkProblem = (): { title: string; description: string } =>
  navigator.onLine
    ? {
        title: 'A newer version is available',
        description:
          'The app was updated while this tab was open. Reload to get the latest version.',
      }
    : {
        title: "You're offline",
        description: 'This page needs a connection to load. Reconnect, then reload the page.',
      };

export const ErrorFallback = ({ error, reset, homeHref = '/' }: ErrorFallbackViewProps) => {
  const outdated = isChunkLoadError(error);
  const chunk = outdated ? chunkProblem() : null;

  return (
    <div role="alert">
      <EmptyState
        icon={TriangleAlert}
        headingLevel={1}
        title={chunk ? chunk.title : "This page didn't load"}
        description={
          chunk
            ? chunk.description
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
