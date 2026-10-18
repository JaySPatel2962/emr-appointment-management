import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

export interface PageLoaderProps {
  label?: string | undefined;
  /** Fill the whole viewport, for the first load before the app shell exists. */
  fullScreen?: boolean | undefined;
}

export const PageLoader = ({ label = 'Loading', fullScreen = false }: PageLoaderProps) => (
  <div
    className={cn(
      'grid place-items-center text-carbon',
      fullScreen ? 'min-h-dvh bg-canvas' : 'min-h-64',
    )}
  >
    <div className="flex flex-col items-center gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-ink-muted" role="status">
        {label}
      </p>
    </div>
  </div>
);
