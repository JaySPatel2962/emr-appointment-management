import { randomUUID } from 'node:crypto';

import type { RequestHandler } from 'express';

import { REQUEST_ID_HEADER } from '#app/constants/http.js';

// A caller-supplied id is reused only if it is short and plain, so it is safe to log and echo back.
const SAFE_REQUEST_ID = /^[\w-]{1,64}$/;

/** Gives every request an id, returned in the X-Request-Id header and included in every log line. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id = incoming !== undefined && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
};
