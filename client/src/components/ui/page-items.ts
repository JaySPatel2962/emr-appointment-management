export type PageItem = number | 'gap';

/**
 * The page links to show: always the first and last page and the pages next to the current one,
 * with a gap where pages are skipped. A gap never hides a single page; that page is shown instead.
 * pageItems(5, 12) -> [1, 'gap', 4, 5, 6, 'gap', 12]
 */
export const pageItems = (current: number, totalPages: number): PageItem[] => {
  if (totalPages <= 0) {
    return [];
  }
  const wanted = new Set([1, totalPages, current - 1, current, current + 1]);
  const pages = [...wanted].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);

  return pages.flatMap((page, index): PageItem[] => {
    const previous = pages[index - 1];
    if (previous === undefined || page - previous === 1) {
      return [page];
    }
    return page - previous === 2 ? [page - 1, page] : ['gap', page];
  });
};

/** "21–40" for page 2 of 20 per page, "0" when there is nothing. */
export const pageRange = (page: number, limit: number, total: number): string => {
  if (total === 0) {
    return '0';
  }
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  return first === last ? String(first) : `${String(first)}–${String(last)}`;
};
