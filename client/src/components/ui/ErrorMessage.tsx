import { RotateCw } from 'lucide-react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/services/api-error';

export interface ErrorMessageProps {
  /** What failed, e.g. "Couldn't load the slots". */
  title: string;
  error: unknown;
  onRetry?: (() => void) | undefined;
  retrying?: boolean | undefined;
  className?: string | undefined;
}

/** A failed load: what went wrong, the request id support can trace, and a way to try again. */
export const ErrorMessage = ({ title, error, onRetry, retrying, className }: ErrorMessageProps) => {
  const message = error instanceof Error ? error.message : 'Something went wrong. Try again.';
  const requestId = error instanceof ApiError ? error.requestId : null;

  return (
    <Alert
      tone="error"
      title={title}
      className={className}
      action={
        onRetry ? (
          <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>
            <RotateCw aria-hidden="true" size={15} />
            Try again
          </Button>
        ) : undefined
      }
    >
      <p>{message}</p>
      {requestId ? <p className="mt-1 text-xs">Reference: {requestId}</p> : null}
    </Alert>
  );
};
