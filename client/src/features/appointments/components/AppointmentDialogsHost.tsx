import { AppointmentDetailsModal } from '@/features/appointments/components/AppointmentDetailsModal';
import { CancelAppointmentDialog } from '@/features/appointments/components/CancelAppointmentDialog';
import { EditAppointmentModal } from '@/features/appointments/components/EditAppointmentModal';
import type { AppointmentActions } from '@/features/appointments/hooks/useAppointmentActions';
import type { AppointmentDialogs } from '@/features/appointments/hooks/useAppointmentDialogs';

export interface AppointmentDialogsHostProps {
  dialogs: AppointmentDialogs;
  actions: AppointmentActions;
}

/** The appointment dialogs a screen can open: details, edit and cancel, one at a time. */
export const AppointmentDialogsHost = ({ dialogs, actions }: AppointmentDialogsHostProps) => {
  const { dialog, close, showEdit, showCancel } = dialogs;

  return (
    <>
      <AppointmentDetailsModal
        id={dialog?.kind === 'details' ? dialog.id : null}
        actions={actions}
        onClose={close}
        onEdit={showEdit}
        onCancel={showCancel}
      />
      <EditAppointmentModal
        appointment={dialog?.kind === 'edit' ? dialog.appointment : null}
        update={actions.update}
        onClose={close}
      />
      <CancelAppointmentDialog
        appointment={dialog?.kind === 'cancel' ? dialog.appointment : null}
        cancel={actions.cancel}
        onClose={close}
      />
    </>
  );
};
