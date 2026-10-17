import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { io as connectClient } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '#app/app.js';
import { APPOINTMENT_EVENTS, SCHEDULER_EVENTS } from '#app/constants/events.js';
import type { AppointmentEventName } from '#app/constants/events.js';
import { ROLES } from '#app/constants/roles.js';
import {
  resetAppointmentEventEmitter,
  setAppointmentEventEmitter,
} from '#app/services/appointment-events.js';
import type { AppointmentEventPayload } from '#app/services/appointment-events.js';
import { signAccessToken } from '#app/services/token.service.js';
import { createSocketAppointmentEmitter } from '#app/sockets/appointment-broadcaster.js';
import { createSocketServer } from '#app/sockets/index.js';
import type { ClientToServerEvents, JoinResult, ServerToClientEvents } from '#app/sockets/types.js';

import { authorizationFor } from '../helpers/auth.js';
import { createDoctor, createPatient, createUser } from '../helpers/factories.js';

type TestSocket = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

const DATE = '2030-01-15';
const httpServer = createServer(createApp());
const io = createSocketServer(httpServer);
const openSockets: TestSocket[] = [];
let baseUrl = '';

beforeAll(async () => {
  setAppointmentEventEmitter(createSocketAppointmentEmitter(io));
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const { port } = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(() => {
  openSockets.splice(0).forEach((socket) => socket.disconnect());
});

afterAll(async () => {
  resetAppointmentEventEmitter();
  await new Promise<void>((resolve) => {
    void io.close(() => {
      resolve();
    });
  });
});

const connect = (token?: string): Promise<TestSocket> =>
  new Promise((resolve, reject) => {
    const socket: TestSocket = connectClient(baseUrl, {
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    openSockets.push(socket);
    socket.once('connect', () => {
      resolve(socket);
    });
    socket.once('connect_error', reject);
  });

const join = (socket: TestSocket, doctorId: string, date = DATE): Promise<JoinResult> =>
  new Promise((resolve) => {
    socket.emit(SCHEDULER_EVENTS.JOIN, { doctorId, date }, resolve);
  });

const nextEvent = (
  socket: TestSocket,
  event: AppointmentEventName,
): Promise<AppointmentEventPayload> =>
  new Promise((resolve) => {
    socket.once(event, resolve);
  });

/** A receptionist with a socket token and an API authorization header. */
const receptionist = async () => {
  const user = await createUser(ROLES.RECEPTIONIST);
  return {
    token: signAccessToken({ id: user._id.toString(), role: ROLES.RECEPTIONIST }),
    authorization: authorizationFor(user),
  };
};

const bookingBody = (doctorId: string, patientId: string) => ({
  doctorId,
  date: DATE,
  slotStart: '13:30',
  purpose: 'Follow-up',
  notes: 'Private clinical note',
  patientId,
});

describe('Socket.IO scheduler updates', () => {
  it('refuses a connection without a valid access token', async () => {
    await expect(connect()).rejects.toThrow('Authentication required');
    await expect(connect('not-a-token')).rejects.toThrow('Invalid or expired token');
  });

  it("pushes created, updated and cancelled events to everyone watching that doctor's day", async () => {
    const { doctor } = await createDoctor({ slotDurationMinutes: 30 });
    const patient = await createPatient();
    const staff = await receptionist();
    const watcher = await connect(staff.token);
    const doctorId = doctor._id.toString();
    expect(await join(watcher, doctorId)).toEqual({
      ok: true,
      room: `scheduler:${doctorId}:${DATE}`,
    });

    const created = nextEvent(watcher, APPOINTMENT_EVENTS.CREATED);
    await request(httpServer)
      .post('/api/v1/appointments')
      .set('Authorization', staff.authorization)
      .send(bookingBody(doctorId, patient._id.toString()));
    const createdEvent = await created;
    expect(createdEvent).toMatchObject({ slotStart: '13:30', status: 'SCHEDULED' });
    expect(createdEvent).not.toHaveProperty('notes');

    const updated = nextEvent(watcher, APPOINTMENT_EVENTS.UPDATED);
    await request(httpServer)
      .post(`/api/v1/appointments/${createdEvent.id}/arrive`)
      .set('Authorization', staff.authorization);
    expect(await updated).toMatchObject({ id: createdEvent.id, status: 'ARRIVED' });

    const cancelled = nextEvent(watcher, APPOINTMENT_EVENTS.CANCELLED);
    await request(httpServer)
      .delete(`/api/v1/appointments/${createdEvent.id}`)
      .set('Authorization', staff.authorization);
    expect(await cancelled).toMatchObject({ id: createdEvent.id, status: 'CANCELLED' });
  });

  it('sends nothing to people watching another doctor or another day', async () => {
    const { doctor } = await createDoctor({ slotDurationMinutes: 30 });
    const { doctor: otherDoctor } = await createDoctor();
    const patient = await createPatient();
    const staff = await receptionist();
    const doctorId = doctor._id.toString();
    const sameRoom = await connect(staff.token);
    const otherDay = await connect(staff.token);
    const otherDoctorWatcher = await connect(staff.token);
    await join(sameRoom, doctorId);
    await join(otherDay, doctorId, '2030-01-16');
    await join(otherDoctorWatcher, otherDoctor._id.toString());
    const strays: unknown[] = [];
    otherDay.on(APPOINTMENT_EVENTS.CREATED, (event) => strays.push(event));
    otherDoctorWatcher.on(APPOINTMENT_EVENTS.CREATED, (event) => strays.push(event));

    const created = nextEvent(sameRoom, APPOINTMENT_EVENTS.CREATED);
    await request(httpServer)
      .post('/api/v1/appointments')
      .set('Authorization', staff.authorization)
      .send(bookingBody(doctorId, patient._id.toString()));
    await created;
    // A socket receives messages in order, so a round trip after the broadcast proves that
    // nothing was sent to these two.
    await join(otherDay, doctorId, '2030-01-16');
    await join(otherDoctorWatcher, otherDoctor._id.toString());

    expect(strays).toEqual([]);
  });

  it('lets a doctor follow only their own scheduler', async () => {
    const { user, doctor } = await createDoctor();
    const { doctor: otherDoctor } = await createDoctor();
    const socket = await connect(
      signAccessToken({
        id: user._id.toString(),
        role: ROLES.DOCTOR,
        doctorId: doctor._id.toString(),
      }),
    );

    expect(await join(socket, doctor._id.toString())).toMatchObject({ ok: true });
    expect(await join(socket, otherDoctor._id.toString())).toEqual({
      ok: false,
      error: 'Doctors can only follow their own schedule',
    });
  });

  it('refuses a malformed room request', async () => {
    const staff = await receptionist();
    const socket = await connect(staff.token);

    expect(await join(socket, 'not-an-id', '2030-02-30')).toMatchObject({ ok: false });
  });

  it('sends every change to Super Admins, without joining a room', async () => {
    const { doctor } = await createDoctor({ slotDurationMinutes: 30 });
    const patient = await createPatient();
    const admin = await createUser(ROLES.SUPER_ADMIN);
    const socket = await connect(
      signAccessToken({ id: admin._id.toString(), role: ROLES.SUPER_ADMIN }),
    );

    const created = nextEvent(socket, APPOINTMENT_EVENTS.CREATED);
    await request(httpServer)
      .post('/api/v1/appointments')
      .set('Authorization', authorizationFor(admin))
      .send(bookingBody(doctor._id.toString(), patient._id.toString()));

    expect(await created).toMatchObject({ doctor: { id: doctor._id.toString() } });
  });
});
