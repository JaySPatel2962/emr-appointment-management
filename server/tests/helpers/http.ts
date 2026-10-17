import type { Response } from 'supertest';

import type { ApiResponse } from '#app/utils/api-response.js';

/** supertest types the response body as `any`; this reads it as the API envelope. */
export const bodyOf = (response: Response): ApiResponse => response.body as ApiResponse;
