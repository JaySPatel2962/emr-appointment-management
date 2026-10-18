import { Link } from 'react-router';
import type { LinkProps } from 'react-router';

import { buttonClasses } from '@/components/ui/button-styles';
import type { ButtonStyleProps } from '@/components/ui/button-styles';
import { cn } from '@/utils/cn';

export interface ButtonLinkProps extends LinkProps, ButtonStyleProps {}

/** Navigation that looks like a button: a real link, so it opens in a new tab and reads as one. */
export const ButtonLink = ({ variant, size, fullWidth, className, ...rest }: ButtonLinkProps) => (
  <Link className={cn(buttonClasses({ variant, size, fullWidth }), className)} {...rest} />
);
