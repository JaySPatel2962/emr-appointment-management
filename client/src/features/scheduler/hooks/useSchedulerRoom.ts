import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { APPOINTMENT_EVENTS, SCHEDULER_EVENTS } from '@/constants/events';
import { syncAppointment } from '@/features/appointments/cache';
import { appointmentKeys } from '@/features/appointments/query-keys';
import { describeChange } from '@/features/scheduler/utils/live-message';
import { slotKeys } from '@/features/slots/queries';
import type { AppointmentChange } from '@/features/slots/utils/live-slots';
import { acquireSocket, releaseSocket } from '@/services/socket';
import type { AppointmentSummary } from '@/types/models';

export type LiveStatus = 'connecting' | 'live' | 'offline';

export interface LiveChange {
  /** The slot that changed, for its tile to glow. */
  slotStart: string;
  /** A sentence for screen readers. */
  message: string;
  /** Tells two identical changes apart. */
  id: number;
}

/**
 * Follows one doctor's day live. Joins the room `scheduler:{doctorId}:{date}`, applies every
 * booking, update and cancellation to the cached grid as it arrives, and leaves the room when
 * the doctor or date changes or the screen closes. After a reconnect it refetches the day, since
 * changes made while it was offline weren't announced.
 */
export const useSchedulerRoom = (doctorId: string | null, date: string) => {
  const queryClient = useQueryClient();
  const roomKey = doctorId === null ? null : `${doctorId}:${date}`;
  const [connection, setConnection] = useState<{ room: string; status: LiveStatus } | null>(null);
  const [lastChange, setLastChange] = useState<(LiveChange & { room: string }) | null>(null);

  useEffect(() => {
    if (doctorId === null) {
      return;
    }
    const room = { doctorId, date };
    const key = `${doctorId}:${date}`;
    const socket = acquireSocket();
    let joinedBefore = false;

    const join = () => {
      socket.emit(SCHEDULER_EVENTS.JOIN, room, (result) => {
        setConnection({ room: key, status: result.ok ? 'live' : 'offline' });
      });
    };
    const handleConnect = () => {
      if (joinedBefore) {
        void queryClient.invalidateQueries({ queryKey: slotKeys.day(doctorId, date) });
        void queryClient.invalidateQueries({ queryKey: appointmentKeys.day(doctorId, date) });
      }
      joinedBefore = true;
      join();
    };
    const handleDisconnect = () => {
      setConnection({ room: key, status: 'offline' });
    };
    const listen = (change: AppointmentChange) => (appointment: AppointmentSummary) => {
      // Super Admins hear about every doctor's day; this screen shows one.
      if (appointment.doctor.id !== doctorId || appointment.date !== date) {
        return;
      }
      syncAppointment(queryClient, appointment, change);
      setLastChange({
        room: key,
        slotStart: appointment.slotStart,
        message: describeChange(change, appointment),
        id: Date.now(),
      });
    };
    const handleCreated = listen('created');
    const handleUpdated = listen('updated');
    const handleCancelled = listen('cancelled');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on(APPOINTMENT_EVENTS.CREATED, handleCreated);
    socket.on(APPOINTMENT_EVENTS.UPDATED, handleUpdated);
    socket.on(APPOINTMENT_EVENTS.CANCELLED, handleCancelled);
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.emit(SCHEDULER_EVENTS.LEAVE, room);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off(APPOINTMENT_EVENTS.CREATED, handleCreated);
      socket.off(APPOINTMENT_EVENTS.UPDATED, handleUpdated);
      socket.off(APPOINTMENT_EVENTS.CANCELLED, handleCancelled);
      releaseSocket();
    };
  }, [doctorId, date, queryClient]);

  return {
    status: connection !== null && connection.room === roomKey ? connection.status : 'connecting',
    lastChange: lastChange !== null && lastChange.room === roomKey ? lastChange : null,
  } satisfies { status: LiveStatus; lastChange: LiveChange | null };
};
