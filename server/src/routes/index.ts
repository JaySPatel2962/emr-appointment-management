import { Router } from 'express';

import { authRouter } from '#app/routes/auth.routes.js';
import { departmentRouter } from '#app/routes/department.routes.js';
import { doctorRouter } from '#app/routes/doctor.routes.js';
import { healthRouter } from '#app/routes/health.routes.js';
import { userRouter } from '#app/routes/user.routes.js';

/** Every route under /api/v1. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/departments', departmentRouter);
apiRouter.use('/doctors', doctorRouter);
