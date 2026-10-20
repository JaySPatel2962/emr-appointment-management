import { describe, expect, it } from 'vitest';

import { nameWords, wordPrefixFilter } from '#app/utils/name-words.js';

describe('nameWords', () => {
  it('splits a name into lowercase words, once each', () => {
    expect(nameWords('Asha  Rao')).toEqual(['asha', 'rao']);
    expect(nameWords("Zoë O'Brien-Smith 😀")).toEqual(['zoe', 'o', 'brien', 'smith', '😀']);
    expect(nameWords('Rao Rao')).toEqual(['rao']);
  });

  it('folds the accents of Latin letters, and leaves other scripts whole', () => {
    expect(nameWords('José Álvarez')).toEqual(['jose', 'alvarez']);
    expect(nameWords('श्रीमती आशा राव')).toEqual(['श्रीमती', 'आशा', 'राव']);
  });

  it('finds no words in separators alone', () => {
    expect(nameWords(' -- . ')).toEqual([]);
  });
});

describe('wordPrefixFilter', () => {
  it('matches one word as an anchored prefix, with regex characters taken literally', () => {
    expect(wordPrefixFilter('nameWords', 'Rao')).toEqual({ nameWords: /^rao/ });
    expect(wordPrefixFilter('nameWords', 'a*')).toEqual({ nameWords: /^a\*/ });
  });

  it('needs every word typed, in any order', () => {
    expect(wordPrefixFilter('nameWords', 'rao asha')).toEqual({
      $and: [{ nameWords: /^rao/ }, { nameWords: /^asha/ }],
    });
  });

  it('matches nothing for a term without words', () => {
    expect(wordPrefixFilter('nameWords', '--')).toEqual({ _id: { $in: [] } });
  });
});
