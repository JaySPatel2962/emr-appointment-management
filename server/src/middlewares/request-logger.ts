import { pinoHttp } from 'pino-http';

import { logger } from '#app/config/logger.js';
import { HTTP_STATUS } from '#app/constants/http.js';

interface SerializedRequest {
  id: unknown;
  method: string;
  url: string;
}

interface SerializedResponse {
  statusCode: number;
}

/**
 * One log line per request: id, method, path, status and duration. The query string is left out
 * because it can hold patient names and mobile numbers, and headers because they carry tokens.
 */
export const requestLogger = pinoHttp({
  logger,
  customLogLevel: (_req, res, error) => {
    if (error !== undefined || res.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      return 'error';
    }
    return res.statusCode >= HTTP_STATUS.BAD_REQUEST ? 'warn' : 'info';
  },
  serializers: {
    req: (req: SerializedRequest) => ({
      id: req.id,
      method: req.method,
      path: req.url.split('?')[0],
    }),
    res: (res: SerializedResponse) => ({ statusCode: res.statusCode }),
  },
});
