import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ScheduleEditor } from '@/features/admin/components/ScheduleEditor';
import { useSaveSchedule } from '@/features/admin/hooks/useAdminMutations';
import { scheduleFormDefaults, scheduleFormSchema } from '@/features/admin/schemas';
import type { ScheduleFormOutput, ScheduleFormValues } from '@/features/admin/schemas';
import { scheduleFieldPath, toEditorDays, toSchedule } from '@/features/admin/utils/schedule-form';
import type { Doctor } from '@/types/models';
import { applyServerFieldErrors, errorMessage } from '@/utils/form-errors';

const defaultsFor = (doctor: Doctor): ScheduleFormValues =>
  scheduleFormDefaults(doctor.slotDurationMinutes, toEditorDays(doctor.schedule));

export interface EditSchedulePanelProps {
  doctor: Doctor;
}

/** One doctor's weekly schedule, saved as a whole. Booked appointments are kept as they are. */
export const EditSchedulePanel = ({ doctor }: EditSchedulePanelProps) => {
  const form = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: defaultsFor(doctor),
    mode: 'onTouched',
  });
  const { mutate, isPending } = useSaveSchedule();
  const [generalError, setGeneralError] = useState<string | null>(null);
  const { isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setGeneralError(null);
    mutate(
      {
        id: doctor.id,
        schedule: toSchedule(values.days),
        slotDurationMinutes: values.slotDurationMinutes,
      },
      {
        onSuccess: (saved) => {
          form.reset(defaultsFor(saved));
        },
        onError: (error) => {
          if (!applyServerFieldErrors(error, form.setError, scheduleFieldPath(values.days))) {
            setGeneralError(errorMessage(error));
          }
        },
      },
    );
  });

  return (
    <Panel
      title={`${doctor.name}'s schedule`}
      description="Saving replaces the whole week. Appointments already booked stay, even if they no longer fit."
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {generalError ? <Alert tone="error">{generalError}</Alert> : null}
        <ScheduleEditor form={form} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={!isDirty || isPending} onClick={() => form.reset()}>
            Undo changes
          </Button>
          <Button type="submit" loading={isPending} disabled={!isDirty}>
            Save schedule
          </Button>
        </div>
      </form>
    </Panel>
  );
};
