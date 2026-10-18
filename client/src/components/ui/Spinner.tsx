import { cn } from '@/utils/cn';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize | undefined;
  /** Announced to screen readers. Leave it out when nearby text already says what is loading. */
  label?: string | undefined;
  className?: string | undefined;
}

const SIZES: Readonly<Record<SpinnerSize, string>> = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-10 border-[3px]',
};

export const Spinner = ({ size = 'md', label, className }: SpinnerProps) => (
  <span role={label ? 'status' : undefined} className={cn('inline-flex items-center', className)}>
    <span
      aria-hidden="true"
      className={cn('animate-spin rounded-full border-current border-r-transparent', SIZES[size])}
    />
    {label ? <span className="sr-only">{label}</span> : null}
  </span>
);
