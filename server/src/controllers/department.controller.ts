import { listDepartments } from '#app/services/department.service.js';
import { sendSuccess } from '#app/utils/api-response.js';
import { asyncHandler } from '#app/utils/async-handler.js';

export const list = asyncHandler(async (_req, res) => {
  sendSuccess(res, { message: 'Departments retrieved', data: await listDepartments() });
});
