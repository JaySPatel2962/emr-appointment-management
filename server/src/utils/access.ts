import { ROLES } from '#app/constants/roles.js';
import type { AuthUser } from '#app/types/auth.js';
import { AppError } from '#app/utils/app-error.js';

export const isDoctor = (actor: AuthUser): boolean => actor.role === ROLES.DOCTOR;

/** The caller's doctor profile id. A doctor's access token always carries it. */
export const requireDoctorId = (actor: AuthUser): string => {
  if (actor.doctorId === undefined) {
    throw AppError.forbidden();
  }
  return actor.doctorId;
};
