import type { RequestHandler } from 'express';

import { AppError } from '#app/utils/app-error.js';

const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * How deeply a JSON body may nest. The deepest real body (a doctor's weekly schedule) is about
 * five levels deep. Without a limit, a small body nested thousands of levels deep would exhaust
 * the call stack below and turn into a 500.
 */
export const MAX_BODY_DEPTH = 32;

// MongoDB operators start with `$` and dotted keys address nested paths, so a client may send neither.
const isUnsafeKey = (key: string): boolean =>
  key.startsWith('$') || key.includes('.') || PROTOTYPE_KEYS.has(key);

/**
 * Returns a copy of the value without operator, dotted or prototype keys, at any depth. Throws a
 * 400 for a value nested deeper than MAX_BODY_DEPTH.
 */
export const stripUnsafeKeys = (value: unknown, depth = 0): unknown => {
  if (depth > MAX_BODY_DEPTH) {
    throw AppError.badRequest('Request body is nested too deeply');
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripUnsafeKeys(item, depth + 1));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isUnsafeKey(key))
        .map(([key, nested]) => [key, stripUnsafeKeys(nested, depth + 1)]),
    );
  }
  return value;
};

/**
 * Cleans JSON bodies. Query strings need no cleaning: Express 5's "simple" query parser never
 * builds nested objects, so `?status[$ne]=x` stays a plain string key that validation rejects.
 */
export const sanitizeInput: RequestHandler = (req, _res, next) => {
  req.body = stripUnsafeKeys(req.body);
  next();
};
