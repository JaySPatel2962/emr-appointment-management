import { logger } from '#app/config/logger.js';
import type { AppointmentEventName } from '#app/constants/events.js';
import type { AppointmentDto } from '#app/services/appointment.service.js';

/** What scheduler screens receive. Clinical notes are left out: a slot grid doesn't need them. */
export type AppointmentEventPayload = Omit<AppointmentDto, 'notes'>;

/** Where appointment changes are announced: Socket.IO in the running server, a mock in tests. */
export interface AppointmentEventEmitter {
  publish: (event: AppointmentEventName, appointment: AppointmentEventPayload) => void;
}

const silentEmitter: AppointmentEventEmitter = { publish: () => undefined };
let currentEmitter = silentEmitter;

export const setAppointmentEventEmitter = (emitter: AppointmentEventEmitter): void => {
  currentEmitter = emitter;
};

export const resetAppointmentEventEmitter = (): void => {
  currentEmitter = silentEmitter;
};

/** Announces a change that is already saved. Never throws: a failed broadcast must not fail the request. */
export const publishAppointmentEvent = (
  event: AppointmentEventName,
  appointment: AppointmentDto,
): void => {
  const { notes: _notes, ...payload } = appointment;
  try {
    currentEmitter.publish(event, payload);
  } catch (error) {
    logger.error({ err: error, event }, 'Failed to publish an appointment event');
  }
};
