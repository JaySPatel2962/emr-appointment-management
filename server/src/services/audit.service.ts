import type { Types } from 'mongoose';

import { logger } from '#app/config/logger.js';
import type { AuditAction, AuditEntity } from '#app/constants/audit.js';
import type { Role } from '#app/constants/roles.js';
import { AuditLogModel } from '#app/models/audit-log.model.js';
import { toObjectId } from '#app/utils/object-id.js';

export interface AuditEntry {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: Types.ObjectId | string;
  /** Who acted. The role is left out when it isn't known, e.g. for a token reuse. */
  actor?: { id: string; role?: Role };
  /** Context such as the client IP or the names of changed fields. Never secrets or clinical text. */
  metadata?: Record<string, unknown>;
}

/**
 * Writes an audit entry. Best effort: a failed write is logged as an error but never fails or
 * undoes the user's action, which has already happened by the time it is audited.
 */
export const recordAudit = async (entry: AuditEntry): Promise<void> => {
  try {
    await AuditLogModel.create({
      action: entry.action,
      entity: entry.entity,
      ...(entry.entityId === undefined ? {} : { entityId: toObjectId(entry.entityId) }),
      ...(entry.actor === undefined ? {} : { userId: toObjectId(entry.actor.id) }),
      ...(entry.actor?.role === undefined ? {} : { role: entry.actor.role }),
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    logger.error(
      { err: error, action: entry.action, entity: entry.entity },
      'Failed to write audit log',
    );
  }
};
