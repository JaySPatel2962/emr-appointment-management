import type { APPOINTMENT_EVENTS, SCHEDULER_EVENTS } from '@/constants/events';
import type { AppointmentSummary } from '@/types/models';

/** One doctor's scheduler on one date: the room `scheduler:{doctorId}:{date}`. */
export interface SchedulerRoom {
  doctorId: string;
  date: string;
}

export type JoinResult = { ok: true; room: string } | { ok: false; error: string };

type AppointmentListener = (appointment: AppointmentSummary) => void;

export interface ServerToClientEvents {
  [APPOINTMENT_EVENTS.CREATED]: AppointmentListener;
  [APPOINTMENT_EVENTS.UPDATED]: AppointmentListener;
  [APPOINTMENT_EVENTS.CANCELLED]: AppointmentListener;
}

export interface ClientToServerEvents {
  [SCHEDULER_EVENTS.JOIN]: (room: SchedulerRoom, ack: (result: JoinResult) => void) => void;
  [SCHEDULER_EVENTS.LEAVE]: (room: SchedulerRoom) => void;
}
