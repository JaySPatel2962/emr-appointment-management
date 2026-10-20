import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { toast } from '@/components/feedback/toast-store';
import { createAppointment } from '@/features/appointments/api';
import { syncAppointment } from '@/features/appointments/cache';
import { bookingSchema, EMPTY_BOOKING } from '@/features/booking/schemas';
import type { BookingFormOutput, BookingFormValues } from '@/features/booking/schemas';
import { bookingFieldPath, toCreateAppointmentBody } from '@/features/booking/utils/booking-body';
import { bookingFailure } from '@/features/booking/utils/booking-failure';
import { patientKeys } from '@/features/patients/queries';
import { slotKeys } from '@/features/slots/queries';
import { schedulerLink } from '@/features/slots/utils/slot-search';
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
      const failure = bookingFailure(error, request.slotStart);
      if (failure.kind === 'slot') {
        void queryClient.invalidateQueries({
          queryKey: slotKeys.day(request.doctorId, request.date),
        });
        onSlotLost();
        setSlotProblem(failure.message);
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
      mutation.error && bookingFailure(mutation.error, '').kind === 'other' ? mutation.error : null,
    slotProblem,
    /** Submitted without a time: say so next to the slots. */
    slotMissing: form.formState.isSubmitted && (doctorId === null || slot === null),
  };
};
