import type { Types } from 'mongoose';

import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '#app/constants/audit.js';
import { ROLES } from '#app/constants/roles.js';
import type { Role } from '#app/constants/roles.js';
import { UserModel } from '#app/models/user.model.js';
import { recordAudit } from '#app/services/audit.service.js';
import { hashPassword } from '#app/services/password.service.js';
import type { AuthUser } from '#app/types/auth.js';
import type { StaffAccountInput } from '#app/validators/user.validators.js';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  doctorId?: string;
}

interface UserRecord {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
}

export const toUserDto = (user: UserRecord, doctorId?: string): UserDto => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  ...(doctorId === undefined ? {} : { doctorId }),
});

/**
 * An unsaved staff account with its password hashed. Hashing first keeps the slow bcrypt step
 * out of any transaction the account is later saved in.
 */
export const buildStaffAccount = async (input: StaffAccountInput, role: Role) =>
  new UserModel({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    role,
  });

/** A duplicate email fails on the unique index and reaches the client as a 409. */
export const createReceptionist = async (
  input: StaffAccountInput,
  actor: AuthUser,
): Promise<UserDto> => {
  const user = await (await buildStaffAccount(input, ROLES.RECEPTIONIST)).save();
  await recordAudit({
    action: AUDIT_ACTIONS.CREATE,
    entity: AUDIT_ENTITIES.USER,
    entityId: user._id,
    actor,
    metadata: { role: ROLES.RECEPTIONIST },
  });
  return toUserDto(user);
};
