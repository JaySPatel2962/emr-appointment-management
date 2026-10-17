import type { Request } from 'express';

/** Where a request came from, recorded with sessions and audit entries. */
export interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

export const getClientInfo = (req: Request): ClientInfo => {
  const userAgent = req.get('user-agent');
  return {
    ...(req.ip === undefined ? {} : { ip: req.ip }),
    ...(userAgent === undefined ? {} : { userAgent }),
  };
};
