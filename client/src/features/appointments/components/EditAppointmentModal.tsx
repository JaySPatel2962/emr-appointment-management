import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { NOTES_MAX_LENGTH, PURPOSE_MAX_LENGTH } from '@/constants/appointment';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import type { AppointmentActions } from '@/features/appointments/hooks/useAppointmentActions';
import type { EditableAppointment } from '@/features/appointments/hooks/useAppointmentDialogs';
import { editAppointmentSchema } from '@/features/appointments/schemas';
import type { EditAppointmentInput, EditAppointmentValues } from '@/features/appointments/schemas';
import { permissionsFor } from '@/features/appointments/utils/permissions';
import { formatDateWithWeekday } from '@/utils/date';
import { applyServerFieldErrors, errorMessage, hasFieldErrors } from '@/utils/form-errors';

const FORM_ID = 'edit-appointment-form';

interface EditFormProps {
  appointment: EditableAppointment;
  update: AppointmentActions['update'];
  onDone: () => void;
}

const EditForm = ({ appointment, update, onDone }: EditFormProps) => {
  const user = useCurrentUser();
  const { canEditPurpose } = permissionsFor(user, appointment);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EditAppointmentValues, unknown, EditAppointmentInput>({
    resolver: zodResolver(editAppointmentSchema),
    defaultValues: { purpose: appointment.purpose, notes: appointment.notes },
  });

  const onSubmit = handleSubmit((values) => {
    // Send only what changed, and never the purpose for a role that can't change it.
    const body = {
      ...(canEditPurpose && values.purpose !== appointment.purpose
        ? { purpose: values.purpose }
        : {}),
      ...(values.notes !== appointment.notes ? { notes: values.notes } : {}),
    };
    if (Object.keys(body).length === 0) {
      onDone();
      return;
    }
    update.mutate(
      { id: appointment.id, ...body },
      {
        onSuccess: onDone,
        onError: (error) => {
          applyServerFieldErrors(error, setError);
        },
      },
    );
  });

  return (
    <form id={FORM_ID} noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      {update.error && !hasFieldErrors(update.error) ? (
        <Alert tone="error">{errorMessage(update.error)}</Alert>
      ) : null}
      {canEditPurpose ? (
        <FormField label="Purpose of the visit" error={errors.purpose?.message}>
          {(control) => (
            <Input {...control} {...register('purpose')} maxLength={PURPOSE_MAX_LENGTH} />
          )}
        </FormField>
      ) : (
        <div>
          <p className="text-sm font-semibold text-ink">Purpose of the visit</p>
          <p className="mt-1 text-sm text-ink-muted">{appointment.purpose}</p>
        </div>
      )}
      <FormField
        label="Notes"
        optional
        hint="Consultation notes, or anything the front desk should know."
        error={errors.notes?.message}
      >
        {(control) => (
          <Textarea {...control} {...register('notes')} rows={6} maxLength={NOTES_MAX_LENGTH} />
        )}
      </FormField>
    </form>
  );
};

export interface EditAppointmentModalProps {
  appointment: EditableAppointment | null;
  update: AppointmentActions['update'];
  onClose: () => void;
}

export const EditAppointmentModal = ({
  appointment,
  update,
  onClose,
}: EditAppointmentModalProps) => {
  const close = () => {
    update.reset();
    onClose();
  };

  return (
    <Modal
      open={appointment !== null}
      onClose={close}
      dismissible={!update.isPending}
      title="Edit appointment"
      description={
        appointment
          ? `${appointment.patient.name}, ${formatDateWithWeekday(appointment.date)} at ${appointment.slotStart} with ${appointment.doctor.name}`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" disabled={update.isPending} onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={update.isPending}>
            Save changes
          </Button>
        </>
      }
    >
      {appointment ? (
        <EditForm key={appointment.id} appointment={appointment} update={update} onDone={close} />
      ) : null}
    </Modal>
  );
};
