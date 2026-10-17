import type { Server as HttpServer } from 'node:http';

import { Server } from 'socket.io';
import { z } from 'zod';

import { env } from '#app/config/env.js';
import { logger } from '#app/config/logger.js';
import { SCHEDULER_EVENTS } from '#app/constants/events.js';
import { ROLES } from '#app/constants/roles.js';
import { accessTokenExpiry, verifyAccessToken } from '#app/services/token.service.js';
import { ADMIN_ROOM, schedulerRoom } from '#app/sockets/rooms.js';
import type { AppSocket, AppSocketServer, JoinResult } from '#app/sockets/types.js';
import { isDoctor } from '#app/utils/access.js';
import { dateSchema, objectIdSchema } from '#app/validators/common.js';

const roomRequestSchema = z.object({ doctorId: objectIdSchema, date: dateSchema });

// Client input is never trusted: a client may send no acknowledgement, or something that isn't one.
const acknowledge = (ack: unknown, result: JoinResult): void => {
  if (typeof ack === 'function') {
    (ack as (result: JoinResult) => void)(result);
  }
};

// The socket is closed when its access token expires; the client reconnects with a fresh token.
const disconnectOnExpiry = (socket: AppSocket, token: string): void => {
  const expiresAt = accessTokenExpiry(token);
  if (expiresAt === undefined) {
    return;
  }
  const timer = setTimeout(
    () => {
      socket.disconnect(true);
    },
    Math.max(0, expiresAt.getTime() - Date.now()),
  );
  socket.once('disconnect', () => {
    clearTimeout(timer);
  });
};

/** Every connection needs a valid access token: io(url, { auth: { token } }). */
const authenticateSocket = (socket: AppSocket, next: (error?: Error) => void): void => {
  const token: unknown = socket.handshake.auth.token;
  if (typeof token !== 'string') {
    next(new Error('Authentication required'));
    return;
  }
  try {
    socket.data.user = verifyAccessToken(token);
  } catch {
    next(new Error('Invalid or expired token'));
    return;
  }
  disconnectOnExpiry(socket, token);
  next();
};

const handleJoin =
  (socket: AppSocket) =>
  (request: unknown, ack: unknown): void => {
    const room = roomRequestSchema.safeParse(request);
    if (!room.success) {
      acknowledge(ack, { ok: false, error: 'doctorId and date (YYYY-MM-DD) are required' });
      return;
    }
    const { user } = socket.data;
    if (isDoctor(user) && user.doctorId !== room.data.doctorId) {
      acknowledge(ack, { ok: false, error: 'Doctors can only follow their own schedule' });
      return;
    }
    const name = schedulerRoom(room.data.doctorId, room.data.date);
    void socket.join(name);
    acknowledge(ack, { ok: true, room: name });
  };

const handleLeave =
  (socket: AppSocket) =>
  (request: unknown): void => {
    const room = roomRequestSchema.safeParse(request);
    if (room.success) {
      void socket.leave(schedulerRoom(room.data.doctorId, room.data.date));
    }
  };

/**
 * Socket.IO on the API's HTTP server. Clients join the room of the scheduler they are looking
 * at (one doctor, one date) and receive every change to it as it happens.
 */
export const createSocketServer = (httpServer: HttpServer): AppSocketServer => {
  const io: AppSocketServer = new Server(httpServer, {
    cors: { origin: [env.CLIENT_URL], credentials: true },
  });

  io.use(authenticateSocket);
  io.on('connection', (socket) => {
    const { user } = socket.data;
    logger.debug({ userId: user.id, role: user.role }, 'Socket connected');
    // Super Admins follow every scheduler at once.
    if (user.role === ROLES.SUPER_ADMIN) {
      void socket.join(ADMIN_ROOM);
    }
    socket.on(SCHEDULER_EVENTS.JOIN, handleJoin(socket));
    socket.on(SCHEDULER_EVENTS.LEAVE, handleLeave(socket));
  });

  return io;
};
