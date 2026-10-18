import { CircleCheck, DoorOpen, Pencil, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useIsActionPending } from '@/features/appointments/hooks/useAppointmentActions';
import type { AppointmentPermissions } from '@/features/appointments/utils/permissions';
import type { Appointment } from '@/types/models';

export interface RowActionHandlers {
  onArrive: (id: string) => void;
  onComplete: (id: string) => void;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
}

export interface AppointmentRowActionsProps extends RowActionHandlers {
  appointment: Appointment;
  permissions: AppointmentPermissions;
}

/**
 * The actions a row offers its user, in workflow order. Each button watches only its own
 * pending state, so a running action doesn't re-render the rest of the table.
 */
export const AppointmentRowActions = ({
  appointment,
  permissions,
  onArrive,
  onComplete,
  onEdit,
  onCancel,
}: AppointmentRowActionsProps) => {
  const arriving = useIsActionPending('arrive', appointment.id);
  const completing = useIsActionPending('complete', appointment.id);
  const name = appointment.patient.name;

  return (
    <div className="flex flex-wrap gap-1.5 @3xl:flex-nowrap @3xl:justify-end">
      {permissions.canArrive ? (
        <Button
          size="sm"
          variant="secondary"
          loading={arriving}
          aria-label={`Mark ${name} as arrived`}
          onClick={() => onArrive(appointment.id)}
        >
          <DoorOpen aria-hidden="true" size={15} />
          Arrived
        </Button>
      ) : null}
      {permissions.canComplete ? (
        <Button
          size="sm"
          variant="secondary"
          loading={completing}
          aria-label={`Complete ${name}'s visit`}
          onClick={() => onComplete(appointment.id)}
        >
          <CircleCheck aria-hidden="true" size={15} />
          Complete
        </Button>
      ) : null}
      {permissions.canEditPurpose || permissions.canEditNotes ? (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Edit ${name}'s appointment`}
          title="Edit"
          onClick={() => onEdit(appointment)}
        >
          <Pencil aria-hidden="true" size={15} />
          <span className="@3xl:sr-only">Edit</span>
        </Button>
      ) : null}
      {permissions.canCancel ? (
        <Button
          size="sm"
          variant="danger-ghost"
          aria-label={`Cancel ${name}'s appointment`}
          title="Cancel"
          onClick={() => onCancel(appointment)}
        >
          <X aria-hidden="true" size={15} />
          <span className="@3xl:sr-only">Cancel</span>
        </Button>
      ) : null}
    </div>
  );
};
