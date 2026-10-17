import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // SHA-256 of the token, never the token itself: a database leak exposes no usable tokens.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    // Set on rotation: the hash of the token that replaced this one.
    replacedByHash: { type: String },
    userAgent: { type: String, maxlength: 500 },
    ip: { type: String, maxlength: 100 },
  },
  { collection: 'refresh_tokens', timestamps: { createdAt: true, updatedAt: false } },
);

// Revoke all of a user's tokens at once (logout everywhere, or reuse of a revoked token).
refreshTokenSchema.index({ userId: 1 });
// MongoDB deletes each token once it expires. Until then a revoked token stays on record, so
// reusing it can be detected.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
