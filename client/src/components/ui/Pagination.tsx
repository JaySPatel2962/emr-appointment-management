import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';

import { pageItems, pageRange } from '@/components/ui/page-items';
import { cn } from '@/utils/cn';

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  /** Plural noun for the summary: "Showing 21–40 of 134 appointments". */
  itemLabel: string;
  onPageChange: (page: number) => void;
  onLimitChange?: ((limit: number) => void) | undefined;
  limitOptions?: readonly number[] | undefined;
}

const PAGE_BUTTON =
  'grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm font-semibold tabular-nums transition-colors';

export const Pagination = ({
  page,
  totalPages,
  total,
  limit,
  itemLabel,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],
}: PaginationProps) => {
  const limitId = useId();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-muted" aria-live="polite">
        Showing <span className="font-semibold text-ink">{pageRange(page, limit, total)}</span> of{' '}
        <span className="font-semibold text-ink">{total}</span> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {onLimitChange ? (
          <div className="flex items-center gap-2">
            <label htmlFor={limitId} className="text-sm text-ink-muted">
              Rows per page
            </label>
            <select
              id={limitId}
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              className="h-9 cursor-pointer rounded-lg border border-line-strong bg-paper px-2 text-sm text-ink"
            >
              {limitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {totalPages > 1 ? (
          <nav aria-label="Pagination">
            <ul className="flex items-center gap-1">
              <li>
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page <= 1}
                  onClick={() => onPageChange(page - 1)}
                  className={cn(PAGE_BUTTON, 'text-ink hover:bg-ink/5 disabled:opacity-35')}
                >
                  <ChevronLeft aria-hidden="true" size={18} />
                </button>
              </li>
              {pageItems(page, totalPages).map((item, index) =>
                item === 'gap' ? (
                  <li
                    key={`gap-${String(index)}`}
                    aria-hidden="true"
                    className="px-1 text-ink-subtle"
                  >
                    …
                  </li>
                ) : (
                  // On phones only the current page shows between the arrows.
                  <li key={item} className={cn(item !== page && 'max-sm:hidden')}>
                    <button
                      type="button"
                      aria-label={`Page ${String(item)}`}
                      aria-current={item === page ? 'page' : undefined}
                      onClick={() => onPageChange(item)}
                      className={cn(
                        PAGE_BUTTON,
                        item === page ? 'bg-carbon text-white' : 'text-ink hover:bg-ink/5',
                      )}
                    >
                      {item}
                    </button>
                  </li>
                ),
              )}
              <li>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange(page + 1)}
                  className={cn(PAGE_BUTTON, 'text-ink hover:bg-ink/5 disabled:opacity-35')}
                >
                  <ChevronRight aria-hidden="true" size={18} />
                </button>
              </li>
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
};
