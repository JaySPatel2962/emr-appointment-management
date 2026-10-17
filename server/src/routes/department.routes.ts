import { Router } from 'express';

import * as departmentController from '#app/controllers/department.controller.js';
import { authenticate } from '#app/middlewares/authenticate.js';

export const departmentRouter = Router();

departmentRouter.get('/', authenticate, departmentController.list);
