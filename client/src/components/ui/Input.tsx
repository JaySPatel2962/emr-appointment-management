import type { ComponentPropsWithRef } from 'react';

import { fieldClasses } from '@/components/ui/field-styles';

export type InputProps = Omit<ComponentPropsWithRef<'input'>, 'className'>;

/** A text input. Wrap it in <FormField>, which labels it and marks it invalid. */
export const Input = (props: InputProps) => <input className={fieldClasses('h-10')} {...props} />;
