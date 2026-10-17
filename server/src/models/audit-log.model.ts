import { model, Schema } from 'mongoose';
import type { Types } from 'mongoose';

import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '#app/constants/audit.js';
import type { AuditAction, AuditEntity } from '#app/constants/audit.js';
import { ROLES } from '#app/constants/roles.js';
import type { Role } from '#app/constants/roles.js';

/** Declared explicitly so the free-form metadata is typed as unknown values rather than `any`. */
export interface AuditLog {
  /** Missing for a failed login with an unknown email. */
  userId?: Types.ObjectId;
  role?: Role;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: Types.ObjectId;
  /** Extra context, such as the attempted email, client IP or changed fields. Never secrets. */
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: Object.values(ROLES) },
    action: { type: String, required: true, enum: Object.values(AUDIT_ACTIONS) },
    entity: { type: String, required: true, enum: Object.values(AUDIT_ENTITIES) },
    entityId: { type: Schema.Types.ObjectId },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  // Append-only: entries are never edited, so only createdAt is recorded. No TTL: medical
  // audit trails are usually kept for years.
  { collection: 'audit_logs', timestamps: { createdAt: true, updatedAt: false } },
);

// Most recent activity first.
auditLogSchema.index({ createdAt: -1 });
// The history of one record, newest first.
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const AuditLogModel = model('AuditLog', auditLogSchema);
