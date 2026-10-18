import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';

import { getAppointment, listAppointments, listDayAppointments } from '@/features/appointments/api';
import type { AppointmentListParams } from '@/features/appointments/api';
import { appointmentKeys } from '@/features/appointments/query-keys';
import { STALE_TIME } from '@/services/query-client';
import type { AppointmentSummary } from '@/types/models';

export const useAppointmentList = (params: AppointmentListParams) =>
  useQuery({
    queryKey: appointmentKeys.list(params),
    queryFn: ({ signal }) => listAppointments(params, signal),
    staleTime: STALE_TIME.live,
    // Paging or filtering keeps the current rows on screen until the next page arrives.
    placeholderData: keepPreviousData,
  });

const DASHBOARD_REFRESH_MS = 60_000;

/** Every appointment of a day, for one doctor or (with `doctorId` null) the whole clinic. */
export const useDayAppointments = (doctorId: string | null, date: string) =>
  useQuery({
    queryKey: appointmentKeys.day(doctorId, date),
    queryFn: ({ signal }) => listDayAppointments(date, doctorId, signal),
    staleTime: STALE_TIME.live,
    refetchInterval: DASHBOARD_REFRESH_MS,
  });

const byId = (appointments: AppointmentSummary[]): ReadonlyMap<string, AppointmentSummary> =>
  new Map(appointments.map((appointment) => [appointment.id, appointment]));

/** One doctor's day, by appointment id: the scheduler puts names on booked slots with it. */
export const useDayAppointmentMap = (doctorId: string | null, date: string) =>
  useQuery({
    queryKey: appointmentKeys.day(doctorId, date),
    queryFn:
      doctorId === null ? skipToken : ({ signal }) => listDayAppointments(date, doctorId, signal),
    staleTime: STALE_TIME.live,
    select: byId,
  });

export const useAppointment = (id: string | null) =>
  useQuery({
    queryKey: appointmentKeys.detail(id ?? ''),
    queryFn: id === null ? skipToken : ({ signal }) => getAppointment(id, signal),
    staleTime: STALE_TIME.live,
  });
