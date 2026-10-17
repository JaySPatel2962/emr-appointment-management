import { describe, expect, it } from 'vitest';

import { stripUnsafeKeys } from '#app/middlewares/sanitize-input.js';

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
});
