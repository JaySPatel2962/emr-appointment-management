import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

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
};

const SIZES: Readonly<Record<ButtonSize, string>> = {
  sm: 'min-h-8 gap-1.5 px-3 text-sm',
  md: 'min-h-10 gap-2 px-4 text-sm',
};

/** Shared by <Button> and <ButtonLink>, so a link that acts as a button looks exactly like one. */
export const buttonClasses = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: ButtonStyleProps = {}): string =>
  cn(
    'inline-flex items-center justify-center rounded-lg font-semibold transition-colors select-none',
    'disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
  );
