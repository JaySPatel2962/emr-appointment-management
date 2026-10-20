import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ScheduleEditor } from '@/features/admin/components/ScheduleEditor';
import { StaleScheduleAlert } from '@/features/admin/components/StaleScheduleAlert';
import { StrandedAppointmentsAlert } from '@/features/admin/components/StrandedAppointmentsAlert';
import { useScheduleEditor } from '@/features/admin/hooks/useScheduleEditor';
import { useRevealOnChange } from '@/hooks/useRevealOnChange';
import type { Doctor } from '@/types/models';

export interface EditSchedulePanelProps {
  doctor: Doctor;
}

/** One doctor's weekly schedule, saved as a whole. Booked appointments are kept as they are. */
export const EditSchedulePanel = ({ doctor }: EditSchedulePanelProps) => {
  const { form, onSubmit, saving, problem, reload, reloading } = useScheduleEditor(doctor);
  const { isDirty } = form.formState;
  const problemRef = useRevealOnChange<HTMLDivElement>(problem);

  return (
    <Panel
      title={`${doctor.name}'s schedule`}
      description="Saving replaces the whole week. A change that would leave a booked appointment without its slot is refused, and so is one made while someone else saved this schedule."
    >
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <ScheduleEditor form={form} />
        {/* Next to the Save button, where the eye is after pressing it, not above the week. */}
        {problem ? (
          <div ref={problemRef} className="scroll-mb-20">
            {problem.kind === 'general' ? <Alert tone="error">{problem.message}</Alert> : null}
            {problem.kind === 'stranded' ? (
              <StrandedAppointmentsAlert
                doctorName={doctor.name}
                appointments={problem.appointments}
              />
            ) : null}
            {problem.kind === 'stale' ? (
              <StaleScheduleAlert
                message={problem.message}
                onReload={() => void reload()}
                reloading={reloading}
              />
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={!isDirty || saving} onClick={() => form.reset()}>
            Undo changes
          </Button>
          <Button type="submit" loading={saving} disabled={!isDirty || reloading}>
            Save schedule
          </Button>
        </div>
      </form>
    </Panel>
  );
};
