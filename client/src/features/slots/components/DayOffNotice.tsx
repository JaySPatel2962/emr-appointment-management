import { CalendarOff } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { nextWorkingDay, weekdayName } from '@/features/doctors/utils/schedule';
import type { Doctor } from '@/types/models';
import { formatDateShort } from '@/utils/date';

export interface DayOffNoticeProps {
  doctor: Doctor;
  date: string;
  onShowDate: (date: string) => void;
}

/** A day with no slots: say why, and offer the doctor's next working day. */
export const DayOffNotice = ({ doctor, date, onShowDate }: DayOffNoticeProps) => {
  const next = nextWorkingDay(doctor, date);
  const noSchedule = doctor.schedule.length === 0;

  return (
    <EmptyState
      icon={CalendarOff}
      title={
        noSchedule
          ? `${doctor.name} has no working days yet`
          : `${doctor.name} has no sessions on ${weekdayName(date)}s`
      }
      description={
        noSchedule
          ? 'A Super Admin can set their schedule under Staff and schedules.'
          : 'Choose another day.'
      }
      action={
        next ? (
          <Button variant="secondary" onClick={() => onShowDate(next)}>
            Show {formatDateShort(next)}
          </Button>
        ) : null
      }
    />
  );
};
