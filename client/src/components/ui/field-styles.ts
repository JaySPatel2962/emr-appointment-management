import { cn } from '@/utils/cn';

/**
 * The shared look of text inputs, selects and text areas. The border turns vermilion from the
 * control's own `aria-invalid`, so styling can't drift from what screen readers are told. Phones
 * get 16px text, so iOS doesn't zoom in on focus.
 */
export const fieldClasses = (...extra: string[]): string =>
  cn(
    'block w-full rounded-lg border border-line-strong bg-paper px-3 text-base text-ink sm:text-sm',
    'placeholder:text-ink-subtle aria-invalid:border-vermilion',
    'focus-visible:border-carbon focus-visible:outline-offset-0',
    'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-subtle',
    ...extra,
  );
