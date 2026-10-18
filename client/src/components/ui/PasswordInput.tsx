import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import type { ComponentPropsWithRef } from 'react';

import { fieldClasses } from '@/components/ui/field-styles';

export type PasswordInputProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'className'>;

/** A password field with a button that shows what was typed, to catch typos before submitting. */
export const PasswordInput = (props: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={fieldClasses('h-10 pr-11')}
      />
      <button
        type="button"
        aria-label="Show password"
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted hover:text-ink"
      >
        <Icon aria-hidden="true" size={18} />
      </button>
    </div>
  );
};
