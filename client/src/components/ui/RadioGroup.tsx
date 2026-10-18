import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import type { ChangeEventHandler, FocusEventHandler, ReactNode, Ref } from 'react';

import { cn } from '@/utils/cn';

export interface RadioOption<V extends string> {
  value: V;
  label: string;
  description?: ReactNode;
}

export type RadioGroupVariant = 'segmented' | 'stacked';

export interface RadioGroupProps<V extends string> {
  legend: string;
  name: string;
  options: readonly RadioOption<V>[];
  /** Controlled use: the chosen value. Leave out with react-hook-form's `register`. */
  value?: V | undefined;
  onChange?: ChangeEventHandler<HTMLInputElement> | undefined;
  onBlur?: FocusEventHandler<HTMLInputElement> | undefined;
  /** react-hook-form registers every radio of a group through one ref. */
  ref?: Ref<HTMLInputElement> | undefined;
  error?: string | undefined;
  /** `segmented` for a short either/or choice, `stacked` for options with descriptions. */
  variant?: RadioGroupVariant | undefined;
  hideLegend?: boolean | undefined;
  disabled?: boolean | undefined;
}

const OPTION_CLASSES: Readonly<Record<RadioGroupVariant, string>> = {
  segmented:
    'flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-semibold text-ink-muted has-checked:bg-paper has-checked:text-carbon has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-carbon',
  stacked:
    'flex cursor-pointer items-start gap-3 rounded-lg border border-line-strong bg-paper p-3 has-checked:border-carbon has-checked:bg-carbon-soft has-focus-visible:outline-2 has-focus-visible:outline-carbon',
};

/** Native radio buttons in a fieldset, so arrow keys and screen readers work as people expect. */
export const RadioGroup = <V extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  onBlur,
  ref,
  error,
  variant = 'stacked',
  hideLegend = false,
  disabled = false,
}: RadioGroupProps<V>) => {
  const errorId = useId();
  const segmented = variant === 'segmented';

  return (
    <fieldset
      aria-describedby={error ? errorId : undefined}
      disabled={disabled}
      className="min-w-0"
    >
      <legend className={cn('mb-1.5 text-sm font-semibold text-ink', hideLegend && 'sr-only')}>
        {legend}
      </legend>
      <div
        className={cn(
          segmented ? 'flex gap-1 rounded-lg bg-canvas p-1' : 'grid gap-2 sm:grid-cols-2',
          error && segmented && 'ring-1 ring-vermilion',
        )}
      >
        {options.map((option) => (
          <label key={option.value} className={OPTION_CLASSES[variant]}>
            <input
              ref={ref}
              type="radio"
              name={name}
              value={option.value}
              onChange={onChange}
              onBlur={onBlur}
              {...(value === undefined ? {} : { checked: value === option.value })}
              className={segmented ? 'sr-only' : 'mt-0.5 size-4 shrink-0 accent-carbon'}
            />
            <span className={cn(!segmented && 'min-w-0')}>
              <span className={cn(!segmented && 'block text-sm font-semibold text-ink')}>
                {option.label}
              </span>
              {option.description && !segmented ? (
                <span className="mt-0.5 block text-xs text-ink-muted">{option.description}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm text-vermilion">
          <CircleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </fieldset>
  );
};
