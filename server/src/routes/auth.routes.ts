import { Router } from 'express';

import * as authController from '#app/controllers/auth.controller.js';
import { loginRateLimiter } from '#app/middlewares/rate-limit.js';
import { validate } from '#app/middlewares/validate.js';
import { loginSchema } from '#app/validators/auth.validators.js';

export const authRouter = Router();

authRouter.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);
