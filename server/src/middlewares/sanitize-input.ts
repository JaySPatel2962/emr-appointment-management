import type { RequestHandler } from 'express';

const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// MongoDB operators start with `$` and dotted keys address nested paths, so a client may send neither.
const isUnsafeKey = (key: string): boolean =>
  key.startsWith('$') || key.includes('.') || PROTOTYPE_KEYS.has(key);

/** Returns a copy of the value without operator, dotted or prototype keys, at any depth. */
export const stripUnsafeKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripUnsafeKeys);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isUnsafeKey(key))
        .map(([key, nested]) => [key, stripUnsafeKeys(nested)]),
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
