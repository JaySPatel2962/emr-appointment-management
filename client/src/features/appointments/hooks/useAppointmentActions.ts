import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/feedback/toast-store';
import {
  cancelAppointment,
  completeAppointment,
  markArrived,
  updateAppointment,
} from '@/features/appointments/api';
import { syncAppointment } from '@/features/appointments/cache';
import { appointmentKeys } from '@/features/appointments/query-keys';
import { slotKeys } from '@/features/slots/queries';
import { errorMessage } from '@/utils/form-errors';

export const appointmentMutationKeys = {
  arrive: [...appointmentKeys.all, 'arrive'] as const,
  complete: [...appointmentKeys.all, 'complete'] as const,
  cancel: [...appointmentKeys.all, 'cancel'] as const,
  update: [...appointmentKeys.all, 'update'] as const,
};

export type AppointmentAction = keyof typeof appointmentMutationKeys;

/**
 * Checking in, completing, cancelling and editing appointments. A success updates every cached
 * view at once; a refusal (409: someone else changed it first) refetches, so the screen shows
 * what is true now.
 */
export const useAppointmentActions = () => {
  const queryClient = useQueryClient();
  const refetchAfterRefusal = () => {
    void queryClient.invalidateQueries({ queryKey: appointmentKeys.all });
    void queryClient.invalidateQueries({ queryKey: slotKeys.all });
  };

  const arrive = useMutation({
    mutationKey: appointmentMutationKeys.arrive,
    mutationFn: markArrived,
    onSuccess: (appointment) => {
      syncAppointment(queryClient, appointment, 'updated');
      toast.success(`${appointment.patient.name} marked as arrived`);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      refetchAfterRefusal();
    },
  });

  const complete = useMutation({
    mutationKey: appointmentMutationKeys.complete,
    mutationFn: completeAppointment,
    onSuccess: (appointment) => {
      syncAppointment(queryClient, appointment, 'updated');
      toast.success(`Visit completed for ${appointment.patient.name}`);
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      refetchAfterRefusal();
    },
  });

  // Cancel and update show their errors inside their dialogs, which cover any toast.
  const cancel = useMutation({
    mutationKey: appointmentMutationKeys.cancel,
    mutationFn: cancelAppointment,
    onSuccess: (appointment) => {
      syncAppointment(queryClient, appointment, 'cancelled');
      toast.success(`Appointment cancelled for ${appointment.patient.name}`);
    },
    onError: refetchAfterRefusal,
  });

  const update = useMutation({
    mutationKey: appointmentMutationKeys.update,
    mutationFn: updateAppointment,
    onSuccess: (appointment) => {
      syncAppointment(queryClient, appointment, 'updated');
      toast.success('Changes saved');
    },
    onError: refetchAfterRefusal,
  });

  return { arrive, complete, cancel, update };
};

export type AppointmentActions = ReturnType<typeof useAppointmentActions>;

/**
 * Whether `action` is running for appointment `id`. The filter matches this appointment's own
 * mutation only: an action on another row leaves this row's result (an empty list) as it was,
 * so the row doesn't re-render.
 */
export const useIsActionPending = (action: AppointmentAction, id: string): boolean =>
  useMutationState({
    filters: {
      mutationKey: appointmentMutationKeys[action],
      status: 'pending',
      predicate: (mutation) => mutation.state.variables === id,
    },
    select: (mutation) => mutation.mutationId,
  }).length > 0;
