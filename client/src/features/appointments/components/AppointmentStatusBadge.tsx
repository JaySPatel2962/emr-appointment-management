import { CalendarClock, CircleCheck, CircleX, DoorOpen } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import type { BadgeTone } from '@/components/ui/Badge';
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_LABELS } from '@/constants/appointment';
import type { AppointmentStatus } from '@/constants/appointment';

const STYLES: Readonly<Record<AppointmentStatus, { tone: BadgeTone; icon: LucideIcon }>> = {
  [APPOINTMENT_STATUS.SCHEDULED]: { tone: 'carbon', icon: CalendarClock },
  [APPOINTMENT_STATUS.ARRIVED]: { tone: 'saffron', icon: DoorOpen },
  [APPOINTMENT_STATUS.COMPLETED]: { tone: 'leaf', icon: CircleCheck },
  [APPOINTMENT_STATUS.CANCELLED]: { tone: 'vermilion', icon: CircleX },
};

export interface AppointmentStatusBadgeProps {
  status: AppointmentStatus;
}

export const AppointmentStatusBadge = ({ status }: AppointmentStatusBadgeProps) => (
  <Badge tone={STYLES[status].tone} icon={STYLES[status].icon}>
    {APPOINTMENT_STATUS_LABELS[status]}
  </Badge>
);
