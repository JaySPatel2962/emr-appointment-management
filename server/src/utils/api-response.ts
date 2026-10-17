import type { Response } from 'express';

import { HTTP_STATUS } from '#app/constants/http.js';

export type ResponseMeta = Record<string, unknown>;

/** The envelope every API response uses. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  meta: ResponseMeta;
}

interface ResponseOptions {
  status: number;
  success: boolean;
  message: string;
  data: unknown;
  meta?: ResponseMeta;
}

type SuccessOptions = Omit<ResponseOptions, 'status' | 'success'> & { status?: number };

export const sendResponse = (
  res: Response,
  { status, success, message, data, meta = {} }: ResponseOptions,
): void => {
  const body: ApiResponse = { success, message, data, meta };
  res.status(status).json(body);
};

export const sendSuccess = (
  res: Response,
  { status = HTTP_STATUS.OK, ...rest }: SuccessOptions,
): void => {
  sendResponse(res, { ...rest, status, success: true });
};
