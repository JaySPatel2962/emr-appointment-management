import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost';
export type ButtonSize = 'sm' | 'md' | 'icon';

export interface ButtonStyleProps {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  fullWidth?: boolean | undefined;
}

const VARIANTS: Readonly<Record<ButtonVariant, string>> = {
  primary: 'bg-carbon text-white hover:bg-carbon-strong',
  secondary: 'border border-line-strong bg-paper text-ink hover:bg-canvas',
  ghost: 'text-ink-muted hover:bg-ink/5 hover:text-ink',
  danger: 'bg-vermilion text-white hover:bg-vermilion-strong',
  // A destructive action that isn't the main one, such as "Cancel" in a row of actions.
  'danger-ghost': 'text-vermilion hover:bg-vermilion-soft',
};

const SIZES: Readonly<Record<ButtonSize, string>> = {
  sm: 'min-h-8 gap-1.5 px-3 text-sm',
  md: 'min-h-10 gap-2 px-4 text-sm',
  /** A square button holding only an icon; give it an aria-label. */
  icon: 'size-10 shrink-0',
};

/** Shared by <Button> and <ButtonLink>, so a link that acts as a button looks exactly like one. */
export const buttonClasses = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: ButtonStyleProps = {}): string =>
  cn(
    'inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors select-none',
    'disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
  );
