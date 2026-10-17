export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  REFRESH_TOKEN_REUSE: 'REFRESH_TOKEN_REUSE',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  CANCEL: 'CANCEL',
  ARRIVE: 'ARRIVE',
  COMPLETE: 'COMPLETE',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITIES = {
  USER: 'USER',
  DOCTOR: 'DOCTOR',
  PATIENT: 'PATIENT',
  APPOINTMENT: 'APPOINTMENT',
} as const;

export type AuditEntity = (typeof AUDIT_ENTITIES)[keyof typeof AUDIT_ENTITIES];
