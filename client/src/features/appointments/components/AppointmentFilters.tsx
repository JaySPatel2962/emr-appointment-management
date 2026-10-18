import { SlidersHorizontal } from 'lucide-react';
import { useId, useState } from 'react';
import type { ChangeEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUSES } from '@/constants/appointment';
import type { AppointmentListParams } from '@/features/appointments/api';
import { hasActiveFilters } from '@/features/appointments/utils/list-params';
import { useDepartments } from '@/features/departments/queries';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { cn } from '@/utils/cn';

const TYPING_DELAY_MS = 350;

const STATUS_OPTIONS = APPOINTMENT_STATUSES.map((status) => ({
  value: status,
  label: APPOINTMENT_STATUS_LABELS[status],
}));

type TextFilter = 'patientName' | 'mobile' | 'doctorName';

export interface AppointmentFiltersProps {
  params: AppointmentListParams;
  onChange: (patch: Partial<AppointmentListParams>) => void;
  onClear: () => void;
  /** Doctors only ever see their own appointments, so they get no doctor or department filter. */
  showDoctorFilters: boolean;
}

/**
 * The list's filters. Text searches wait for a pause in typing before they update the URL (and
 * so the request); choices apply at once. On phones the panel folds away behind a button.
 */
export const AppointmentFilters = ({
  params,
  onChange,
  onClear,
  showDoctorFilters,
}: AppointmentFiltersProps) => {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<Record<TextFilter, string>>({
    patientName: params.patientName ?? '',
    mobile: params.mobile ?? '',
    doctorName: params.doctorName ?? '',
  });
  const pushText = useDebouncedCallback(onChange, TYPING_DELAY_MS);
  const { data: departments = [] } = useDepartments();
  const active = hasActiveFilters(params);

  const changeText = (key: TextFilter) => (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setText((current) => ({ ...current, [key]: value }));
    pushText({ [key]: value.trim() === '' ? undefined : value.trim() });
  };

  const clear = () => {
    setText({ patientName: '', mobile: '', doctorName: '' });
    onClear();
  };

  return (
    <section aria-label="Filters" className="rounded-xl border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
        >
          <SlidersHorizontal aria-hidden="true" size={16} />
          {open ? 'Hide filters' : 'Show filters'}
        </Button>
        {active ? (
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <div
        id={panelId}
        className={cn(
          'grid gap-4 sm:grid-cols-2 lg:grid-cols-4',
          !open && 'max-md:hidden',
          'max-md:mt-4',
        )}
      >
        <FormField label="Patient name" hint="The start of the name">
          {(control) => (
            <Input
              {...control}
              type="search"
              value={text.patientName}
              onChange={changeText('patientName')}
              autoComplete="off"
            />
          )}
        </FormField>
        <FormField label="Mobile" hint="The start of the number">
          {(control) => (
            <Input
              {...control}
              type="search"
              inputMode="tel"
              value={text.mobile}
              onChange={changeText('mobile')}
              autoComplete="off"
            />
          )}
        </FormField>
        {showDoctorFilters ? (
          <FormField label="Doctor" hint="Any part of the name">
            {(control) => (
              <Input
                {...control}
                type="search"
                value={text.doctorName}
                onChange={changeText('doctorName')}
                autoComplete="off"
              />
            )}
          </FormField>
        ) : null}
        {showDoctorFilters ? (
          <FormField label="Department" hint="Every department, or one">
            {(control) => (
              <Select
                {...control}
                placeholder="All departments"
                options={departments.map((department) => ({
                  value: department.id,
                  label: department.name,
                }))}
                value={params.departmentId ?? ''}
                onChange={(event) =>
                  onChange({
                    departmentId: event.target.value === '' ? undefined : event.target.value,
                  })
                }
              />
            )}
          </FormField>
        ) : null}
        <FormField label="Status">
          {(control) => (
            <Select
              {...control}
              placeholder="Any status"
              options={STATUS_OPTIONS}
              value={params.status ?? ''}
              onChange={(event) => {
                const status = APPOINTMENT_STATUSES.find((value) => value === event.target.value);
                onChange({ status });
              }}
            />
          )}
        </FormField>
        <FormField label="From">
          {(control) => (
            <DatePicker
              {...control}
              value={params.dateFrom ?? null}
              max={params.dateTo}
              clearable
              placeholder="Any date"
              onChange={(date) => onChange({ dateFrom: date ?? undefined })}
            />
          )}
        </FormField>
        <FormField label="To">
          {(control) => (
            <DatePicker
              {...control}
              value={params.dateTo ?? null}
              min={params.dateFrom}
              clearable
              placeholder="Any date"
              onChange={(date) => onChange({ dateTo: date ?? undefined })}
            />
          )}
        </FormField>
      </div>

      {active ? (
        <div className="mt-4 hidden justify-end md:flex">
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </section>
  );
};
