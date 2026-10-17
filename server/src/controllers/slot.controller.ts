import { getValidated } from '#app/middlewares/validate.js';
import { getDoctorDaySlots } from '#app/services/slot.service.js';
import { sendSuccess } from '#app/utils/api-response.js';
import { asyncHandler } from '#app/utils/async-handler.js';
import { getAuthUser } from '#app/utils/auth-user.js';
import { slotsSchema } from '#app/validators/slot.validators.js';

export const getDaySlots = asyncHandler(async (req, res) => {
  const { query } = getValidated(req, slotsSchema);
  const daySlots = await getDoctorDaySlots(query, getAuthUser(req));
  sendSuccess(res, { message: 'Slots retrieved', data: daySlots });
});
