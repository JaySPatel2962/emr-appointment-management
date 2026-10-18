import { describe, expect, it } from 'vitest';

import { MAX_BODY_DEPTH, stripUnsafeKeys } from '#app/middlewares/sanitize-input.js';
import { AppError } from '#app/utils/app-error.js';

const nestedArrays = (depth: number): unknown =>
  JSON.parse(`${'['.repeat(depth)}${']'.repeat(depth)}`);

describe('stripUnsafeKeys', () => {
  it('removes Mongo operator, dotted and prototype keys at any depth', () => {
    const body: unknown = JSON.parse(
      '{"name":"Asha","$where":"1","a.b":1,"__proto__":{"isAdmin":true},' +
        '"filter":{"$gt":"","ok":1},"items":[{"$ne":1,"keep":2}]}',
    );

    expect(stripUnsafeKeys(body)).toEqual({
      name: 'Asha',
      filter: { ok: 1 },
      items: [{ keep: 2 }],
    });
  });

  it('leaves primitives and a missing body untouched', () => {
    expect(stripUnsafeKeys(undefined)).toBeUndefined();
    expect(stripUnsafeKeys('text')).toBe('text');
    expect(stripUnsafeKeys(42)).toBe(42);
  });

  it('accepts a body nested up to the depth limit', () => {
    expect(() => stripUnsafeKeys(nestedArrays(MAX_BODY_DEPTH + 1))).not.toThrow();
  });

  // Found in manual QA: 20,000 nested arrays (40 KB) overflowed the stack and gave a 500.
  it('refuses a deeper body with a 400 instead of overflowing the stack', () => {
    for (const depth of [MAX_BODY_DEPTH + 2, 20_000]) {
      expect(() => stripUnsafeKeys(nestedArrays(depth))).toThrow(
        expect.objectContaining({ statusCode: 400, message: 'Request body is nested too deeply' }),
      );
    }
    expect(() => stripUnsafeKeys(nestedArrays(20_000))).toThrow(AppError);
  });
});
