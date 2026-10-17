import type { Document, Schema } from 'mongoose';

/**
 * Keeps `target` as a lowercase copy of `source`, refreshed before every validation (so on
 * create and save). Case-insensitive prefix search can then run as an anchored /^text/ query
 * on the indexed copy: a /text/i query on the original field can't use an index efficiently.
 */
export const lowercaseCopy =
  (source: string, target: string) =>
  (schema: Schema): void => {
    schema.pre('validate', function (this: Document) {
      const value: unknown = this.get(source);
      if (typeof value === 'string') {
        this.set(target, value.toLowerCase());
      }
    });
  };
