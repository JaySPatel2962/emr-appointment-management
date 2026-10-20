import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ScheduleEditor } from '@/features/admin/components/ScheduleEditor';
import { StrandedAppointmentsAlert } from '@/features/admin/components/StrandedAppointmentsAlert';
import { useSaveSchedule } from '@/features/admin/hooks/useAdminMutations';
import { scheduleFormDefaults, scheduleFormSchema } from '@/features/admin/schemas';
import type { ScheduleFormOutput, ScheduleFormValues } from '@/features/admin/schemas';
import { scheduleFieldPath, toEditorDays, toSchedule } from '@/features/admin/utils/schedule-form';
import { strandedAppointmentsIn } from '@/features/admin/utils/stranded';
import type { StrandedAppointment } from '@/features/admin/utils/stranded';
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
  const [stranded, setStranded] = useState<StrandedAppointment[]>([]);
  const { isDirty } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setGeneralError(null);
    setStranded([]);
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
          const blocking = strandedAppointmentsIn(error);
          if (blocking.length > 0) {
            setStranded(blocking);
            return;
          }
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
      description="Saving replaces the whole week. A change that would leave a booked appointment without its slot is refused."
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        {generalError ? <Alert tone="error">{generalError}</Alert> : null}
        {stranded.length > 0 ? (
          <StrandedAppointmentsAlert doctorName={doctor.name} appointments={stranded} />
        ) : null}
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
