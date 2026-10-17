import { HTTP_STATUS } from '#app/constants/http.js';
import { getValidated } from '#app/middlewares/validate.js';
import * as userService from '#app/services/user.service.js';
import { sendSuccess } from '#app/utils/api-response.js';
import { asyncHandler } from '#app/utils/async-handler.js';
import { getAuthUser } from '#app/utils/auth-user.js';
import { createReceptionistSchema } from '#app/validators/user.validators.js';

export const createReceptionist = asyncHandler(async (req, res) => {
  const { body } = getValidated(req, createReceptionistSchema);
  const user = await userService.createReceptionist(body, getAuthUser(req));
  sendSuccess(res, { status: HTTP_STATUS.CREATED, message: 'Receptionist created', data: user });
});
