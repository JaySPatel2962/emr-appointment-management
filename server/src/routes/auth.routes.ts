import { Router } from 'express';

import * as authController from '#app/controllers/auth.controller.js';
import { loginRateLimiter } from '#app/middlewares/rate-limit.js';
import { requireTrustedOrigin } from '#app/middlewares/require-trusted-origin.js';
import { validate } from '#app/middlewares/validate.js';
import { loginSchema } from '#app/validators/auth.validators.js';

export const authRouter = Router();

authRouter.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
// Authenticated by the cookie alone, so other sites may not call them.
authRouter.post('/refresh', requireTrustedOrigin, authController.refresh);
authRouter.post('/logout', requireTrustedOrigin, authController.logout);
