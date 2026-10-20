import { z } from 'zod';

import { HTTP_STATUS } from '@/constants/http';
import { ROUTES } from '@/constants/routes';
import { ApiError } from '@/services/api-error';

// A schedule change that would leave booked appointments without their slot is refused with a
// 409, and the appointments are listed in `meta.appointments`.

const strandedAppointmentsSchema = z.array(
  z.object({
    id: z.string(),
    date: z.string(),
    slotStart: z.string(),
    slotEnd: z.string(),
    status: z.string(),
    patient: z.object({ id: z.string(), patientCode: z.string(), name: z.string() }),
  }),
);

export type StrandedAppointment = z.infer<typeof strandedAppointmentsSchema>[number];

/** The booked appointments that made the API refuse a schedule change; none for any other error. */
export const strandedAppointmentsIn = (error: unknown): StrandedAppointment[] => {
  if (!(error instanceof ApiError) || error.status !== HTTP_STATUS.CONFLICT) {
    return [];
  }
  const parsed = strandedAppointmentsSchema.safeParse(error.meta.appointments);
  return parsed.success ? parsed.data : [];
};

/** The appointment list showing one doctor's day, where a stranded appointment can be handled. */
export const appointmentListLink = (doctorName: string, date: string): string =>
  `${ROUTES.appointments}?${new URLSearchParams({ doctorName, dateFrom: date, dateTo: date }).toString()}`;
