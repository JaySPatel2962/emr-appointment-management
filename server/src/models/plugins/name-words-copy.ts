import type { Document, Schema } from 'mongoose';

import { nameWords } from '#app/utils/name-words.js';

/**
 * Keeps `target` as the searchable words of `source` (see utils/name-words.ts), refreshed before
 * every validation, so on create and save. Existing documents are filled in by
 * `npm run backfill:name-words`.
 */
export const nameWordsCopy =
  (source: string, target: string) =>
  (schema: Schema): void => {
    schema.pre('validate', function (this: Document) {
      const value: unknown = this.get(source);
      if (typeof value === 'string') {
        this.set(target, nameWords(value));
      }
    });
  };
