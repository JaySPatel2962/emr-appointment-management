import type { RequestHandler } from 'express';

import { HTTP_STATUS } from '#app/constants/http.js';
import { getHealthStatus } from '#app/services/health.service.js';
import { sendResponse } from '#app/utils/api-response.js';

// 503 when the database is down, so load balancers and uptime checks take the instance out of rotation.
export const getHealth: RequestHandler = (_req, res) => {
  const health = getHealthStatus();
  const healthy = health.status === 'ok';
  sendResponse(res, {
    status: healthy ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE,
    success: healthy,
    message: healthy ? 'Service is healthy' : 'Database is unavailable',
    data: health,
  });
};
