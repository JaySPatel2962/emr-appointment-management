import bcrypt from 'bcrypt';

import { env } from '#app/config/env.js';

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, env.BCRYPT_ROUNDS);

export const verifyPassword = (password: string, passwordHash: string): Promise<boolean> =>
  bcrypt.compare(password, passwordHash);
