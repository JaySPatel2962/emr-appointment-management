import { CircleAlert } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

/** What a control needs to be tied to its label, hint and error. Spread it onto the control. */
export interface FieldControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

export interface FormFieldProps {
  label: string;
  /** Guidance shown under the label, such as an expected format. */
  hint?: ReactNode;
  error?: string | undefined;
  /** Marks the field "(optional)": every unmarked field is required. */
  optional?: boolean | undefined;
  /** Keeps the label for screen readers only, where the context already names the field. */
  hideLabel?: boolean | undefined;
  className?: string | undefined;
  children: (control: FieldControlProps) => ReactNode;
}

export const FormField = ({
  label,
  hint,
  error,
  optional = false,
  hideLabel = false,
  className,
  children,
}: FormFieldProps) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* `${id}-label` lets a control that shows a value, like the date button, name itself
          with both the label and that value. */}
      <label
        id={`${id}-label`}
        htmlFor={id}
        className={cn('text-sm font-semibold text-ink', hideLabel && 'sr-only')}
      >
        {label}
        {optional ? <span className="font-normal text-ink-muted"> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-vermilion">
          <CircleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </div>
  );
};
