import type { Role } from '#app/constants/roles.js';

/** The authenticated caller, taken from a verified access token. */
export interface AuthUser {
  id: string;
  role: Role;
  /** Set only for DOCTOR users: the id of their doctor profile. */
  doctorId?: string;
}
