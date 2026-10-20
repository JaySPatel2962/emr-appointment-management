import { randomUUID } from 'node:crypto';

import type { Types } from 'mongoose';

import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '#app/constants/audit.js';
import { ROLES } from '#app/constants/roles.js';
import type { Role } from '#app/constants/roles.js';
import { DoctorModel } from '#app/models/doctor.model.js';
import { RefreshTokenModel } from '#app/models/refresh-token.model.js';
import { UserModel } from '#app/models/user.model.js';
import { recordAudit } from '#app/services/audit.service.js';
import { hashPassword, verifyPassword } from '#app/services/password.service.js';
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '#app/services/token.service.js';
import type { SignedRefreshToken } from '#app/services/token.service.js';
import { toUserDto } from '#app/services/user.service.js';
import type { UserDto } from '#app/services/user.service.js';
import type { AuthUser } from '#app/types/auth.js';
import { AppError } from '#app/utils/app-error.js';
import type { ClientInfo } from '#app/utils/client-info.js';

// One message for every failed login, so it never reveals which emails have accounts.
const INVALID_CREDENTIALS = 'Invalid email or password';
const SESSION_EXPIRED = 'Your session has expired, please log in again';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: UserDto;
}

interface UserRecord {
  _id: Types.ObjectId;
  name: string;
  email: string;
  role: Role;
}

// Checked against when the email is unknown, so a failed login takes as long either way.
let dummyPasswordHash: Promise<string> | undefined;
const getDummyPasswordHash = (): Promise<string> =>
  (dummyPasswordHash ??= hashPassword(randomUUID()));

const toAuthUser = async (user: UserRecord): Promise<AuthUser> => {
  const id = user._id.toString();
  if (user.role !== ROLES.DOCTOR) {
    return { id, role: user.role };
  }
  const doctor = await DoctorModel.findOne({ userId: user._id }, { _id: 1 }).lean();
  if (!doctor) {
    throw new Error(`Doctor account ${id} has no doctor profile`);
  }
  return { id, role: user.role, doctorId: doctor._id.toString() };
};

const saveRefreshToken = async (
  userId: Types.ObjectId,
  refreshToken: SignedRefreshToken,
  client: ClientInfo,
): Promise<void> => {
  await RefreshTokenModel.create({
    userId,
    tokenHash: hashToken(refreshToken.token),
    expiresAt: refreshToken.expiresAt,
    ...client,
  });
};

const buildSession = (
  user: UserRecord,
  authUser: AuthUser,
  refreshToken: SignedRefreshToken,
): AuthSession => ({
  accessToken: signAccessToken(authUser),
  refreshToken: refreshToken.token,
  refreshTokenExpiresAt: refreshToken.expiresAt,
  user: toUserDto(user, authUser.doctorId),
});

const loginFailureReason = (userExists: boolean, passwordMatches: boolean): string => {
  if (!userExists) {
    return 'UNKNOWN_EMAIL';
  }
  return passwordMatches ? 'ACCOUNT_DISABLED' : 'WRONG_PASSWORD';
};

export const login = async (
  credentials: { email: string; password: string },
  client: ClientInfo,
): Promise<AuthSession> => {
  const user = await UserModel.findOne({ email: credentials.email }).select('+passwordHash').lean();
  const passwordMatches = await verifyPassword(
    credentials.password,
    user?.passwordHash ?? (await getDummyPasswordHash()),
  );

  if (!user || !passwordMatches || !user.isActive) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entity: AUDIT_ENTITIES.USER,
      ...(user ? { entityId: user._id, actor: { id: user._id.toString(), role: user.role } } : {}),
      metadata: {
        email: credentials.email,
        reason: loginFailureReason(user !== null, passwordMatches),
        ...client,
      },
    });
    throw AppError.unauthorized(INVALID_CREDENTIALS);
  }

  const authUser = await toAuthUser(user);
  const refreshToken = signRefreshToken(authUser.id);
  await saveRefreshToken(user._id, refreshToken, client);
  await recordAudit({
    action: AUDIT_ACTIONS.LOGIN,
    entity: AUDIT_ENTITIES.USER,
    entityId: user._id,
    actor: authUser,
    metadata: { ...client },
  });
  return buildSession(user, authUser, refreshToken);
};

/** A user as an audit actor, with their role (a refresh token records only the user id). */
const auditActor = async (userId: Types.ObjectId): Promise<{ id: string; role?: Role }> => {
  const user = await UserModel.findById(userId, { role: 1 }).lean();
  return { id: userId.toString(), ...(user ? { role: user.role } : {}) };
};

// A revoked token coming back means it was copied: end every session of that user.
const revokeAllSessions = async (userId: Types.ObjectId, client: ClientInfo): Promise<void> => {
  await RefreshTokenModel.updateMany(
    { userId, revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  );
  await recordAudit({
    action: AUDIT_ACTIONS.REFRESH_TOKEN_REUSE,
    entity: AUDIT_ENTITIES.USER,
    entityId: userId,
    actor: await auditActor(userId),
    metadata: { ...client },
  });
};

/**
 * Exchanges a refresh token for a new access token and a new refresh token (rotation). The old
 * token is revoked; presenting it again revokes every session of the user.
 */
export const refresh = async (
  refreshToken: string | undefined,
  client: ClientInfo,
): Promise<AuthSession> => {
  if (refreshToken === undefined) {
    throw AppError.unauthorized('Refresh token missing');
  }
  const { userId } = verifyRefreshToken(refreshToken);
  const stored = await RefreshTokenModel.findOne({ tokenHash: hashToken(refreshToken) }).lean();
  if (stored?.userId.toString() !== userId) {
    throw AppError.unauthorized(SESSION_EXPIRED);
  }
  if (stored.revokedAt) {
    await revokeAllSessions(stored.userId, client);
    throw AppError.unauthorized(SESSION_EXPIRED);
  }

  const user = await UserModel.findById(stored.userId).lean();
  if (!user?.isActive) {
    await RefreshTokenModel.updateOne({ _id: stored._id }, { revokedAt: new Date() });
    throw AppError.unauthorized(SESSION_EXPIRED);
  }

  const authUser = await toAuthUser(user);
  const nextToken = signRefreshToken(authUser.id);
  // Claim the old token atomically: of two concurrent refreshes with the same token, one wins.
  const claimed = await RefreshTokenModel.findOneAndUpdate(
    { _id: stored._id, revokedAt: { $exists: false } },
    { revokedAt: new Date(), replacedByHash: hashToken(nextToken.token) },
  ).lean();
  if (!claimed) {
    throw AppError.unauthorized(SESSION_EXPIRED);
  }
  await saveRefreshToken(user._id, nextToken, client);
  return buildSession(user, authUser, nextToken);
};

/** Revokes the refresh token. Idempotent: an unknown or already revoked token is ignored. */
export const logout = async (
  refreshToken: string | undefined,
  client: ClientInfo,
): Promise<void> => {
  if (refreshToken === undefined) {
    return;
  }
  const revoked = await RefreshTokenModel.findOneAndUpdate(
    { tokenHash: hashToken(refreshToken), revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  ).lean();
  if (revoked) {
    await recordAudit({
      action: AUDIT_ACTIONS.LOGOUT,
      entity: AUDIT_ENTITIES.USER,
      entityId: revoked.userId,
      actor: await auditActor(revoked.userId),
      metadata: { ...client },
    });
  }
};
