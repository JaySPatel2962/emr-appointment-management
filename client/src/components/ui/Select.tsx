import { ChevronDown } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';

import { fieldClasses } from '@/components/ui/field-styles';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean | undefined;
}

export interface SelectProps extends Omit<
  ComponentPropsWithRef<'select'>,
  'className' | 'children'
> {
  options: readonly SelectOption[];
  /** A first, empty choice such as "All departments" or "Choose a doctor". */
  placeholder?: string | undefined;
}

/** A native select, styled to match the inputs: keyboard, screen reader and phone pickers for free. */
export const Select = ({ options, placeholder, ...rest }: SelectProps) => (
  <div className="relative">
    <select className={fieldClasses('h-10 cursor-pointer appearance-none pr-10')} {...rest}>
      {placeholder === undefined ? null : <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
    <ChevronDown
      aria-hidden="true"
      size={18}
      className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-muted"
    />
  </div>
);
