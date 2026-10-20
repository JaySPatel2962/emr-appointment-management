import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { toast } from '@/components/feedback/toast-store';
import { useSaveSchedule } from '@/features/admin/hooks/useAdminMutations';
import { scheduleFormDefaults, scheduleFormSchema } from '@/features/admin/schemas';
import type { ScheduleFormOutput, ScheduleFormValues } from '@/features/admin/schemas';
import { scheduleFieldPath, toEditorDays, toSchedule } from '@/features/admin/utils/schedule-form';
import { isStaleSchedule } from '@/features/admin/utils/stale-schedule';
import { strandedAppointmentsIn } from '@/features/admin/utils/stranded';
import type { StrandedAppointment } from '@/features/admin/utils/stranded';
import { getDoctor } from '@/features/doctors/api';
import { doctorKeys } from '@/features/doctors/queries';
import { slotKeys } from '@/features/slots/queries';
import type { Doctor } from '@/types/models';
import { applyServerFieldErrors, errorMessage } from '@/utils/form-errors';

/** Why the last save didn't go through, when it wasn't about one field. */
export type ScheduleProblem =
  | { kind: 'general'; message: string }
  | { kind: 'stranded'; appointments: StrandedAppointment[] }
  | { kind: 'stale'; message: string };

const defaultsFor = (doctor: Doctor): ScheduleFormValues =>
  scheduleFormDefaults(doctor.slotDurationMinutes, toEditorDays(doctor.schedule));

/**
 * The schedule editor's form and its save. A save sends the version the form was loaded from,
 * not the doctor's latest: the doctor can be refetched while the form still shows what was
 * loaded, and a save based on an outdated week must be refused rather than undo a newer one.
 * After that refusal, `reload` replaces the form with the saved schedule.
 */
export const useScheduleEditor = (doctor: Doctor) => {
  const queryClient = useQueryClient();
  const form = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: defaultsFor(doctor),
    mode: 'onTouched',
  });
  const { mutate, isPending } = useSaveSchedule();
  const [loadedVersion, setLoadedVersion] = useState(doctor.scheduleVersion);
  const [problem, setProblem] = useState<ScheduleProblem | null>(null);
  const [reloading, setReloading] = useState(false);
  const [reloads, setReloads] = useState(0);

  // After a reload, focus goes to the top of the reloaded form. It waits for the render:
  // reset() drops the fields' refs until they mount again.
  const { setFocus } = form;
  useEffect(() => {
    if (reloads > 0) {
      setFocus('slotDurationMinutes');
    }
  }, [reloads, setFocus]);

  const load = (saved: Doctor) => {
    form.reset(defaultsFor(saved));
    setLoadedVersion(saved.scheduleVersion);
  };

  const onSubmit = form.handleSubmit((values) => {
    setProblem(null);
    mutate(
      {
        id: doctor.id,
        schedule: toSchedule(values.days),
        slotDurationMinutes: values.slotDurationMinutes,
        scheduleVersion: loadedVersion,
      },
      {
        onSuccess: load,
        onError: (error) => {
          if (isStaleSchedule(error)) {
            setProblem({ kind: 'stale', message: error.message });
            return;
          }
          const stranded = strandedAppointmentsIn(error);
          if (stranded.length > 0) {
            setProblem({ kind: 'stranded', appointments: stranded });
            return;
          }
          if (!applyServerFieldErrors(error, form.setError, scheduleFieldPath(values.days))) {
            setProblem({ kind: 'general', message: errorMessage(error) });
          }
        },
      },
    );
  });

  /** Replaces the form with the schedule as saved now. What was changed here is dropped. */
  const reload = async () => {
    setReloading(true);
    try {
      const latest = await queryClient.query({
        queryKey: doctorKeys.detail(doctor.id),
        queryFn: ({ signal }) => getDoctor(doctor.id, signal),
        staleTime: 0,
      });
      void queryClient.invalidateQueries({ queryKey: doctorKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: slotKeys.all });
      load(latest);
      setProblem(null);
      toast.info(`Reloaded ${latest.name}'s schedule as it is saved now`);
      setReloads((count) => count + 1);
    } catch (error) {
      setProblem({ kind: 'general', message: errorMessage(error) });
    } finally {
      setReloading(false);
    }
  };

  return { form, onSubmit, saving: isPending, problem, reload, reloading };
};
