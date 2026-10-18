import type { ComponentPropsWithRef } from 'react';

import { buttonClasses } from '@/components/ui/button-styles';
import type { ButtonStyleProps } from '@/components/ui/button-styles';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

export interface ButtonProps extends ComponentPropsWithRef<'button'>, ButtonStyleProps {
  /** Shows a spinner and blocks further clicks while the action runs. */
  loading?: boolean | undefined;
}

export const Button = ({
  variant,
  size,
  fullWidth,
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) => (
  <button
    type={type}
    className={cn(buttonClasses({ variant, size, fullWidth }), className)}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    {...rest}
  >
    {loading ? <Spinner size="sm" /> : null}
    {children}
  </button>
);
