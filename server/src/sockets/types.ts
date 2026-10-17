import type { Server, Socket } from 'socket.io';

import type { AppointmentEventName } from '#app/constants/events.js';
import type { AppointmentEventPayload } from '#app/services/appointment-events.js';
import type { AuthUser } from '#app/types/auth.js';

/** One doctor's scheduler on one date. */
export interface SchedulerRoomRequest {
  doctorId: string;
  date: string;
}

export type JoinResult = { ok: true; room: string } | { ok: false; error: string };

export type ServerToClientEvents = Record<
  AppointmentEventName,
  (appointment: AppointmentEventPayload) => void
>;

export interface ClientToServerEvents {
  'scheduler:join': (room: SchedulerRoomRequest, ack: (result: JoinResult) => void) => void;
  'scheduler:leave': (room: SchedulerRoomRequest) => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  user: AuthUser;
}

export type AppSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
