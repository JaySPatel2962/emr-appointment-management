import { CalendarCheck, Plus, X } from 'lucide-react';
import { useFieldArray, useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  MAX_RANGES_PER_DAY,
  SLOT_DURATION_OPTIONS,
  WEEK_ORDER,
  WEEKDAY_LABELS,
} from '@/constants/doctor';
import type { ScheduleFormOutput, ScheduleFormValues } from '@/features/admin/schemas';
import { EMPTY_RANGE, standardWeek } from '@/features/admin/utils/schedule-form';

type ScheduleForm = UseFormReturn<ScheduleFormValues, unknown, ScheduleFormOutput>;
type RangeKind = 'sessions' | 'breaks';

const KIND_LABELS: Readonly<
  Record<RangeKind, { title: string; one: string; caption: string; hint: string }>
> = {
  sessions: {
    title: 'Sessions',
    one: 'session',
    caption: 'Session',
    hint: 'When the doctor sees patients.',
  },
  breaks: {
    title: 'Breaks',
    one: 'break',
    caption: 'Break',
    hint: 'No slots are offered inside a break, such as lunch.',
  },
};

interface RangeListProps {
  form: ScheduleForm;
  dayIndex: number;
  dayName: string;
  kind: RangeKind;
}

const RangeList = ({ form, dayIndex, dayName, kind }: RangeListProps) => {
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: `days.${dayIndex}.${kind}` });
  const listErrors = errors.days?.[dayIndex]?.[kind];
  const listMessage = listErrors?.message ?? listErrors?.root?.message;
  const { title, one, caption, hint } = KIND_LABELS[kind];

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-semibold text-ink">{title}</legend>
      <p className="mb-2 text-xs text-ink-muted">{hint}</p>
      {fields.length === 0 ? <p className="mb-2 text-sm text-ink-muted">No {kind}.</p> : null}
      {/*
        A range is one row: start, "to", end, remove. Below 18rem that leaves each time box too
        narrow to show "09:00" beside the browser's clock button, so the range's name and its
        remove button take a line of their own and the two times share the full width.
      */}
      <ul className="@container flex flex-col gap-2">
        {fields.map((field, rangeIndex) => {
          const rangeError = listErrors?.[rangeIndex];
          const label = `${dayName} ${one} ${String(rangeIndex + 1)}`;
          return (
            <li key={field.id}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 @2xs:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                <span aria-hidden="true" className="col-span-2 text-sm text-ink-muted @2xs:hidden">
                  {caption} {rangeIndex + 1}
                </span>
                <FormField label={`${label} starts`} hideLabel className="min-w-0">
                  {(control) => (
                    <Input
                      {...control}
                      aria-invalid={rangeError ? true : undefined}
                      {...register(`days.${dayIndex}.${kind}.${rangeIndex}.start`)}
                      type="time"
                      step={300}
                    />
                  )}
                </FormField>
                <span aria-hidden="true" className="text-sm text-ink-muted">
                  to
                </span>
                <FormField label={`${label} ends`} hideLabel className="min-w-0">
                  {(control) => (
                    <Input
                      {...control}
                      aria-invalid={rangeError ? true : undefined}
                      {...register(`days.${dayIndex}.${kind}.${rangeIndex}.end`)}
                      type="time"
                      step={300}
                    />
                  )}
                </FormField>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${label}`}
                  className="col-start-3 row-start-1 justify-self-end @2xs:col-start-4"
                  disabled={kind === 'sessions' && fields.length === 1}
                  onClick={() => remove(rangeIndex)}
                >
                  <X aria-hidden="true" size={16} />
                </Button>
              </div>
              {rangeError?.message ? (
                <p role="alert" className="mt-1 text-sm text-vermilion">
                  {rangeError.message}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {listMessage ? (
        <p role="alert" className="mt-1 text-sm text-vermilion">
          {listMessage}
        </p>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="mt-2"
        disabled={fields.length >= MAX_RANGES_PER_DAY}
        onClick={() => append({ ...EMPTY_RANGE })}
      >
        <Plus aria-hidden="true" size={15} />
        Add a {one}
      </Button>
    </fieldset>
  );
};

const DayRow = ({ form, dayIndex }: { form: ScheduleForm; dayIndex: number }) => {
  const { control, register } = form;
  const works = useWatch({ control, name: `days.${dayIndex}.works` });
  const dayOfWeek = useWatch({ control, name: `days.${dayIndex}.dayOfWeek` });
  const dayName = WEEKDAY_LABELS[dayOfWeek] ?? '';

  return (
    <li className="p-4">
      <Checkbox
        label={dayName}
        description={works ? 'Working day' : 'Day off: no slots'}
        {...register(`days.${dayIndex}.works`)}
      />
      {works ? (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <RangeList form={form} dayIndex={dayIndex} dayName={dayName} kind="sessions" />
          <RangeList form={form} dayIndex={dayIndex} dayName={dayName} kind="breaks" />
        </div>
      ) : null}
    </li>
  );
};

export interface ScheduleEditorProps {
  form: ScheduleForm;
}

/**
 * A doctor's week: the slot length, and for each day whether they work, their sessions and
 * their breaks. Problems (overlapping sessions, a break outside working hours) show on the
 * range they are about.
 */
export const ScheduleEditor = ({ form }: ScheduleEditorProps) => {
  const {
    register,
    formState: { errors },
    control,
  } = form;
  const current = useWatch({ control, name: 'slotDurationMinutes' });
  const durations = [...new Set([...SLOT_DURATION_OPTIONS.map(String), current])]
    .filter((value) => value !== '')
    .sort((a, b) => Number(a) - Number(b))
    .map((value) => ({ value, label: `${value} minutes` }));

  // A preset replaces every day, so the form is reset to it (which rebuilds the field arrays).
  const useStandardWeek = () => {
    form.reset({ ...form.getValues(), days: standardWeek() }, { keepDefaultValues: true });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <FormField
          label="Slot length"
          hint="Each appointment's length"
          error={errors.slotDurationMinutes?.message}
          className="w-48"
        >
          {(controlProps) => (
            <Select {...controlProps} {...register('slotDurationMinutes')} options={durations} />
          )}
        </FormField>
        <Button variant="secondary" onClick={useStandardWeek}>
          <CalendarCheck aria-hidden="true" size={16} />
          Use a standard week
        </Button>
      </div>
      <ol className="divide-y divide-line rounded-xl border border-line" aria-label="Working days">
        {WEEK_ORDER.map((dayOfWeek, dayIndex) => (
          <DayRow key={dayOfWeek} form={form} dayIndex={dayIndex} />
        ))}
      </ol>
    </div>
  );
};
