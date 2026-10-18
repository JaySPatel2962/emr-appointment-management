import { useDoctor } from '@/features/doctors/queries';
import { dayScheduleOn } from '@/features/doctors/utils/schedule';
import { useDaySlots } from '@/features/slots/queries';

/** A doctor's day: the doctor, that weekday's sessions and breaks, and the slots. */
export const useDoctorDay = (doctorId: string | null, date: string) => {
  const doctorQuery = useDoctor(doctorId);
  const slotsQuery = useDaySlots(doctorId, date);
  const doctor = doctorQuery.data;

  return {
    doctor,
    day: doctor ? dayScheduleOn(doctor, date) : undefined,
    slots: slotsQuery.data?.slots,
    slotsQuery,
  };
};
