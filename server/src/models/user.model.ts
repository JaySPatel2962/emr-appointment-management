import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

import { ROLES } from '#app/constants/roles.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Stored lowercase, so the unique index treats Asha@Clinic.in and asha@clinic.in as one login.
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    // Left out of every query unless explicitly selected, which only the login check does.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: Object.values(ROLES) },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// Set after the schema is built: inside the constructor, a transform typed from the schema
// makes TypeScript lose the inferred document type.
userSchema.set('toJSON', {
  versionKey: false,
  // Defence in depth: even a document loaded with +passwordHash never serializes it.
  transform: (_doc, ret) => {
    const { passwordHash: _passwordHash, ...safe } = ret;
    return safe;
  },
});

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model('User', userSchema);
