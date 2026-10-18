import { cn } from '@/utils/cn';

export interface BrandMarkProps {
  /** `inverse` sits on a carbon background. */
  tone?: 'default' | 'inverse' | undefined;
}

/** The product's mark and name: a day sheet with a tick, in carbon-copy blue. */
export const BrandMark = ({ tone = 'default' }: BrandMarkProps) => {
  const inverse = tone === 'inverse';

  return (
    <span className="inline-flex items-center gap-2.5">
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-8 shrink-0">
        <rect width="32" height="32" rx="7" className={inverse ? 'fill-white' : 'fill-carbon'} />
        <g
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={inverse ? 'stroke-carbon' : 'stroke-white'}
        >
          <rect x="7" y="9" width="18" height="16" rx="2.5" />
          <path d="M7 14h18M12 6.5v4M20 6.5v4" />
          <path d="M12.5 19.5l2.25 2.25 4.75-4.75" />
        </g>
      </svg>
      <span
        className={cn('text-base font-bold tracking-tight', inverse ? 'text-white' : 'text-ink')}
      >
        EMR Appointments
      </span>
    </span>
  );
};
