import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { toast } from '@/components/feedback/toast-store';
import { HTTP_STATUS } from '@/constants/http';
import { createAppointment } from '@/features/appointments/api';
import { syncAppointment } from '@/features/appointments/cache';
import { bookingSchema, EMPTY_BOOKING } from '@/features/booking/schemas';
import type { BookingFormOutput, BookingFormValues } from '@/features/booking/schemas';
import { bookingFieldPath, toCreateAppointmentBody } from '@/features/booking/utils/booking-body';
import { patientKeys } from '@/features/patients/queries';
import { slotKeys } from '@/features/slots/queries';
import { schedulerLink } from '@/features/slots/utils/slot-search';
import { hasStatus } from '@/services/api-error';
import { formatDateShort } from '@/utils/date';
import { applyServerFieldErrors } from '@/utils/form-errors';

export interface UseBookingFormOptions {
  doctorId: string | null;
  date: string;
  slot: string | null;
  /** The chosen slot was taken (409) or has started (422): drop it from the selection. */
  onSlotLost: () => void;
}

/**
 * The booking form and its submit. On success every cached view of the slot turns BOOKED and
 * the scheduler opens on that day. If someone else got the slot first, the server answers 409:
 * the form keeps everything typed, refetches the slots and asks for another time.
 */
export const useBookingForm = ({ doctorId, date, slot, onSlotLost }: UseBookingFormOptions) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [slotProblem, setSlotProblem] = useState<string | null>(null);
  const form = useForm<BookingFormValues, unknown, BookingFormOutput>({
    resolver: zodResolver(bookingSchema),
    defaultValues: EMPTY_BOOKING,
  });

  const mutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: (appointment) => {
      syncAppointment(queryClient, appointment, 'created');
      void queryClient.invalidateQueries({ queryKey: patientKeys.all });
      toast.success(
        `Booked ${appointment.patient.name} with ${appointment.doctor.name} on ${formatDateShort(appointment.date)} at ${appointment.slotStart}`,
      );
      void navigate(schedulerLink(appointment.doctor.id, appointment.date));
    },
    onError: (error, request) => {
      const taken = hasStatus(error, HTTP_STATUS.CONFLICT);
      if (taken || hasStatus(error, HTTP_STATUS.UNPROCESSABLE)) {
        void queryClient.invalidateQueries({
          queryKey: slotKeys.day(request.doctorId, request.date),
        });
        onSlotLost();
        setSlotProblem(
          taken
            ? `Someone else booked ${request.slotStart} a moment ago. Choose another time.`
            : `${error.message}. Choose another time.`,
        );
        return;
      }
      applyServerFieldErrors(error, form.setError, bookingFieldPath);
    },
  });

  const submit = form.handleSubmit((values) => {
    setSlotProblem(null);
    if (doctorId === null || slot === null) {
      return;
    }
    mutation.mutate(toCreateAppointmentBody(values, { doctorId, date, slotStart: slot }));
  });

  return {
    form,
    submit,
    submitting: mutation.isPending,
    /** A failure that isn't about the slot or a single field. */
    error:
      mutation.error &&
      !hasStatus(mutation.error, HTTP_STATUS.CONFLICT) &&
      !hasStatus(mutation.error, HTTP_STATUS.UNPROCESSABLE)
        ? mutation.error
        : null,
    slotProblem,
    /** Submitted without a time: say so next to the slots. */
    slotMissing: form.formState.isSubmitted && (doctorId === null || slot === null),
  };
};
