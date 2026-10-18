import { cn } from '@/utils/cn';

export interface SkeletonProps {
  /** Size and shape, e.g. "h-4 w-32". */
  className?: string | undefined;
}

/** A placeholder block shown while content loads. Hidden from screen readers. */
export const Skeleton = ({ className }: SkeletonProps) => (
  <span aria-hidden="true" className={cn('block animate-pulse rounded-md bg-ink/8', className)} />
);
