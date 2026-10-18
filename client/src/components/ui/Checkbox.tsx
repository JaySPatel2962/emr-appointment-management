import { useId } from 'react';
import type { ComponentPropsWithRef, ReactNode } from 'react';

export interface CheckboxProps extends Omit<ComponentPropsWithRef<'input'>, 'type' | 'className'> {
  label: ReactNode;
  /** Extra detail under the label. */
  description?: ReactNode;
}

export const Checkbox = ({ label, description, id, ...rest }: CheckboxProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;

  return (
    <div className="flex items-start gap-3">
      <input
        id={inputId}
        type="checkbox"
        aria-describedby={descriptionId}
        className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line-strong accent-carbon"
        {...rest}
      />
      <div className="min-w-0">
        <label htmlFor={inputId} className="cursor-pointer text-sm font-semibold text-ink">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-xs text-ink-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
};
