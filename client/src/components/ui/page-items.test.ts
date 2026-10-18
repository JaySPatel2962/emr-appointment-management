import { describe, expect, it } from 'vitest';

import { pageItems, pageRange } from '@/components/ui/page-items';

describe('pageItems', () => {
  it('shows the first, last and neighbouring pages, with gaps between', () => {
    expect(pageItems(5, 12)).toEqual([1, 'gap', 4, 5, 6, 'gap', 12]);
  });

  it('shows a lone skipped page instead of a gap', () => {
    expect(pageItems(3, 12)).toEqual([1, 2, 3, 4, 'gap', 12]);
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
  });

  it('handles the edges', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(12, 12)).toEqual([1, 'gap', 11, 12]);
    expect(pageItems(1, 0)).toEqual([]);
  });
});

describe('pageRange', () => {
  it('describes the rows on a page', () => {
    expect(pageRange(2, 20, 134)).toBe('21–40');
    expect(pageRange(7, 20, 134)).toBe('121–134');
    expect(pageRange(1, 20, 1)).toBe('1');
    expect(pageRange(1, 20, 0)).toBe('0');
  });
});
