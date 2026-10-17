import type { AppointmentEventEmitter } from '#app/services/appointment-events.js';
import { ADMIN_ROOM, schedulerRoom } from '#app/sockets/rooms.js';
import type { AppSocketServer } from '#app/sockets/types.js';

/** Sends each change to the room of that doctor and date, and to the Super Admins' room. */
export const createSocketAppointmentEmitter = (io: AppSocketServer): AppointmentEventEmitter => ({
  publish: (event, appointment) => {
    io.to([schedulerRoom(appointment.doctor.id, appointment.date), ADMIN_ROOM]).emit(
      event,
      appointment,
    );
  },
});
