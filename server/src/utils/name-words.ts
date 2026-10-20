import { escapeRegex } from '#app/utils/regex.js';

// Name search matches words, not just the start of the full name: "rao" finds "Asha Rao", and
// "rao asha" finds her too. Each name keeps an indexed array of its words, and each word typed
// must be the start of one of them.

// Spaces and the punctuation found inside names ("O'Brien-Smith", "Dr. Rao") separate words.
const WORD_SEPARATORS = /[\s\-.,'"’()/]+/u;
// Accents of Latin letters are folded ("José" is stored as "jose") so either spelling finds the
// name. Only this block of combining marks is removed: the vowel signs of Devanagari and other
// scripts are part of the letter and stay.
const LATIN_ACCENTS = /[̀-ͯ]/g;

/** The words of a name or a search term: lowercase, accents folded, each once. */
export const nameWords = (text: string): string[] => [
  ...new Set(
    text
      .normalize('NFD')
      .replace(LATIN_ACCENTS, '')
      .toLowerCase()
      .split(WORD_SEPARATORS)
      .filter((word) => word.length > 0),
  ),
];

/**
 * A filter on a word array: every word of the term must be the start of a word of the name.
 * Each condition is an anchored prefix, so the index on the array answers it. A term with no
 * words (only separators) matches nothing.
 */
export const wordPrefixFilter = (field: string, term: string): Record<string, unknown> => {
  const words = nameWords(term);
  if (words.length === 0) {
    return { _id: { $in: [] } };
  }
  const conditions = words.map((word) => ({ [field]: new RegExp(`^${escapeRegex(word)}`) }));
  return conditions.length === 1 ? (conditions[0] ?? {}) : { $and: conditions };
};
