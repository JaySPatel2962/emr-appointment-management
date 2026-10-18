import type { Account, Gender } from './seed-data';

// A small client for the API, used to seed data and to act as "someone else" during a test
// (another receptionist booking or cancelling while the page under test is open).

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta: unknown;
}

export type AppointmentStatus = 'SCHEDULED' | 'ARRIVED' | 'COMPLETED' | 'CANCELLED';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'RECEPTIONIST' | 'DOCTOR';
  doctorId?: string;
}

export interface ApiAppointment {
  id: string;
  date: string;
  slotStart: string;
  status: AppointmentStatus;
  purpose: string;
  patient: { id: string; patientCode: string; name: string; mobile: string };
  doctor: { id: string; name: string };
}

export interface ApiPage<T> {
  items: T[];
  total: number;
}

export interface NewPatientBody {
  name: string;
  mobile: string;
  gender: Gender;
  dateOfBirth?: string;
}

export type BookingBody = {
  doctorId: string;
  date: string;
  slotStart: string;
  purpose: string;
  notes?: string;
} & ({ patientId: string } | { newPatient: NewPatientBody });

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

const send = async (
  apiUrl: string,
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<{ data: unknown; meta: unknown }> => {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token === null ? {} : { Authorization: `Bearer ${token}` }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const envelope = (await response.json()) as Envelope<unknown>;
  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      `${method} ${path} answered ${response.status}: ${envelope.message}`,
    );
  }
  return { data: envelope.data, meta: envelope.meta };
};

export interface ApiClient {
  user: ApiUser;
  get: <T>(path: string) => Promise<T>;
  /** A paginated list: its items and the total across pages. */
  page: <T>(path: string) => Promise<ApiPage<T>>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
  put: <T>(path: string, body: unknown) => Promise<T>;
  delete: <T>(path: string) => Promise<T>;
}

/** Logs in through the API. The access token lasts 15 minutes, so log in again per test. */
export const signInToApi = async (apiUrl: string, account: Account): Promise<ApiClient> => {
  const { data } = await send(apiUrl, 'POST', '/auth/login', null, {
    email: account.email,
    password: account.password,
  });
  const session = data as { accessToken: string; user: ApiUser };
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> =>
    (await send(apiUrl, method, path, session.accessToken, body)).data as T;

  return {
    user: session.user,
    get: <T>(path: string) => call<T>('GET', path),
    page: async <T>(path: string): Promise<ApiPage<T>> => {
      const response = await send(apiUrl, 'GET', path, session.accessToken);
      return { items: response.data as T[], total: (response.meta as { total: number }).total };
    },
    post: <T>(path: string, body?: unknown) => call<T>('POST', path, body),
    put: <T>(path: string, body: unknown) => call<T>('PUT', path, body),
    delete: <T>(path: string) => call<T>('DELETE', path),
  };
};

export const book = (api: ApiClient, body: BookingBody): Promise<ApiAppointment> =>
  api.post<ApiAppointment>('/appointments', body);

/** The query string for GET /appointments. */
export const appointmentQuery = (params: Record<string, string | number>): string =>
  `/appointments?${new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString()}`;

/** The active (not cancelled) appointments of one doctor's day. */
export const activeAppointments = async (
  api: ApiClient,
  doctorId: string,
  date: string,
): Promise<ApiAppointment[]> => {
  const { items } = await api.page<ApiAppointment>(
    appointmentQuery({ doctorId, dateFrom: date, dateTo: date, limit: 100 }),
  );
  return items.filter((appointment) => appointment.status !== 'CANCELLED');
};

/**
 * Books, or returns the booking an earlier attempt already made: Playwright reruns a spec's
 * beforeAll in a fresh worker after a failure, and the slot is taken by then.
 */
export const ensureBooked = async (api: ApiClient, body: BookingBody): Promise<ApiAppointment> => {
  try {
    return await book(api, body);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 409) {
      throw error;
    }
    const existing = (await activeAppointments(api, body.doctorId, body.date)).find(
      (appointment) => appointment.slotStart === body.slotStart,
    );
    if (!existing) {
      throw error;
    }
    return existing;
  }
};

export const arrive = (api: ApiClient, id: string): Promise<ApiAppointment> =>
  api.post<ApiAppointment>(`/appointments/${id}/arrive`);

export const complete = (api: ApiClient, id: string): Promise<ApiAppointment> =>
  api.post<ApiAppointment>(`/appointments/${id}/complete`);

export const cancel = (api: ApiClient, id: string): Promise<ApiAppointment> =>
  api.delete<ApiAppointment>(`/appointments/${id}`);
