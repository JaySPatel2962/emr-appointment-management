import type { ComponentPropsWithRef } from 'react';

import { fieldClasses } from '@/components/ui/field-styles';

export type TextareaProps = Omit<ComponentPropsWithRef<'textarea'>, 'className'>;

export const Textarea = ({ rows = 3, ...rest }: TextareaProps) => (
  <textarea
    rows={rows}
    className={fieldClasses('min-h-20 resize-y py-2 leading-normal')}
    {...rest}
  />
);
