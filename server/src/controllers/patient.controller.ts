import { getValidated } from '#app/middlewares/validate.js';
import { searchPatients } from '#app/services/patient.service.js';
import { sendPage } from '#app/utils/api-response.js';
import { asyncHandler } from '#app/utils/async-handler.js';
import { searchPatientsSchema } from '#app/validators/patient.validators.js';

export const search = asyncHandler(async (req, res) => {
  const { query } = getValidated(req, searchPatientsSchema);
  sendPage(res, 'Patients retrieved', await searchPatients(query));
});
