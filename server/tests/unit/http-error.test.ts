import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { AppError } from '#app/utils/app-error.js';
import { toHttpError } from '#app/utils/http-error.js';

describe('toHttpError', () => {
  it('keeps the status and message of an AppError', () => {
    expect(toHttpError(AppError.conflict('Slot already booked'))).toEqual({
      statusCode: 409,
      message: 'Slot already booked',
      unexpected: false,
    });
  });

  it('turns a ZodError into 400 with one detail per invalid field', () => {
    const schema = z.object({ body: z.object({ email: z.email() }) });
    const { error } = schema.safeParse({ body: { email: 'not-an-email' } });

    expect(toHttpError(error)).toEqual({
      statusCode: 400,
      message: 'Validation failed',
      details: [{ field: 'body.email', message: 'Invalid email address' }],
      unexpected: false,
    });
  });

  it('maps a MongoDB duplicate key error to 409 naming the field', () => {
    expect(toHttpError({ code: 11000, keyPattern: { email: 1 } })).toMatchObject({
      statusCode: 409,
      message: 'A record with the same email already exists',
    });
  });

  it('maps an invalid ObjectId to 400', () => {
    const castError = new mongoose.Error.CastError('ObjectId', 'abc', 'doctorId');

    expect(toHttpError(castError)).toMatchObject({
      statusCode: 400,
      message: 'Invalid value for doctorId',
    });
  });

  it('maps JWT errors to 401', () => {
    expect(toHttpError(new jwt.TokenExpiredError('jwt expired', new Date()))).toMatchObject({
      statusCode: 401,
      message: 'Token has expired',
    });
    expect(toHttpError(new jwt.JsonWebTokenError('invalid signature'))).toMatchObject({
      statusCode: 401,
      message: 'Invalid token',
    });
  });

  it('answers a write conflict with 409 "try again", not a 500 with the driver\'s message', () => {
    const conflict = new mongoose.mongo.MongoServerError({
      message: 'Write conflict during plan execution',
      code: 112,
      codeName: 'WriteConflict',
      errorLabels: ['TransientTransactionError'],
    });

    expect(toHttpError(conflict)).toEqual({
      statusCode: 409,
      message: 'This could not be saved because of a change made at the same moment. Try again.',
      meta: { code: 'CONCURRENT_UPDATE' },
      unexpected: false,
    });
  });

  it('hides anything unexpected behind a generic 500', () => {
    expect(toHttpError(new Error('connection string leaked here'))).toEqual({
      statusCode: 500,
      message: 'Internal server error',
      unexpected: true,
    });
  });
});
