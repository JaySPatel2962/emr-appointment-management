import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { AppointmentActions } from '@/features/appointments/hooks/useAppointmentActions';
import type { AppointmentSummary } from '@/types/models';
import { formatDateWithWeekday } from '@/utils/date';
import { errorMessage } from '@/utils/form-errors';

export interface CancelAppointmentDialogProps {
  appointment: AppointmentSummary | null;
  cancel: AppointmentActions['cancel'];
  onClose: () => void;
}

export const CancelAppointmentDialog = ({
  appointment,
  cancel,
  onClose,
}: CancelAppointmentDialogProps) => {
  const close = () => {
    cancel.reset();
    onClose();
  };

  return (
    <ConfirmDialog
      open={appointment !== null}
      title="Cancel this appointment?"
      description={
        appointment ? (
          <>
            {appointment.patient.name}'s appointment with {appointment.doctor.name} on{' '}
            {formatDateWithWeekday(appointment.date)} at {appointment.slotStart} will be cancelled,
            and the slot will open for booking again. The record stays in the list.
          </>
        ) : null
      }
      confirmLabel="Cancel appointment"
      cancelLabel="Keep appointment"
      pending={cancel.isPending}
      error={cancel.error ? errorMessage(cancel.error) : null}
      onCancel={close}
      onConfirm={() => {
        if (appointment) {
          cancel.mutate(appointment.id, { onSuccess: close });
        }
      }}
    />
  );
};
