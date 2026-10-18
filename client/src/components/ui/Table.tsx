/* eslint-disable jsx-a11y-x/no-redundant-roles, jsx-a11y-x/no-interactive-element-to-noninteractive-role -- On phones CSS turns rows into cards (display: block), and some browsers then drop a table's semantics. Explicit table, rowgroup, row and cell roles keep them. */
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { memo } from 'react';
import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/Skeleton';
import type { SortOrder } from '@/types/api';
import { cn } from '@/utils/cn';

export interface SortState<S extends string> {
  by: S;
  order: SortOrder;
}

export interface TableColumn<T, S extends string = string> {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** The API field this column sorts by. Leave it out for columns that don't sort. */
  sortKey?: S | undefined;
  align?: 'start' | 'end' | undefined;
  /** Layout classes for this column's cells on wide screens, such as a width. */
  className?: string | undefined;
  /** On phones each row is a card, and this cell is its heading: first, and without a label. */
  primary?: boolean | undefined;
  /** On phones, show the cell without its column label (for the actions column). */
  hideLabelOnMobile?: boolean | undefined;
  /** Shows the column only on extra-wide screens, for detail that can wait. */
  visibleFrom?: 'xl' | undefined;
}

export interface TableProps<T, S extends string = string> {
  /** Names the table for screen readers. */
  caption: string;
  columns: readonly TableColumn<T, S>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  sort?: SortState<S> | undefined;
  onSortChange?: ((by: S) => void) | undefined;
  /** The first load: skeleton rows instead of data. */
  loading?: boolean | undefined;
  /** A background refresh: the current rows stay, dimmed. */
  refreshing?: boolean | undefined;
  /** Shown in place of rows when there are none. */
  empty?: ReactNode;
  skeletonRows?: number | undefined;
}

const SORT_NAMES: Readonly<Record<SortOrder, 'ascending' | 'descending'>> = {
  asc: 'ascending',
  desc: 'descending',
};

// A row is a card (a flex column) on phones and a table row from the md breakpoint up.
const ROW_CLASSES =
  'flex flex-col border-b border-line px-4 py-3 last:border-b-0 @3xl:table-row @3xl:p-0';

const cellDisplay = (visibleFrom: TableColumn<never>['visibleFrom']): string =>
  visibleFrom === 'xl' ? 'hidden @6xl:table-cell' : 'flex @3xl:table-cell';

const HeaderCell = <T, S extends string>({
  column,
  sort,
  onSortChange,
}: {
  column: TableColumn<T, S>;
  sort: SortState<S> | undefined;
  onSortChange: ((by: S) => void) | undefined;
}) => {
  const { sortKey } = column;
  const active = sortKey !== undefined && sort?.by === sortKey;
  const SortIcon = active ? (sort.order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      role="columnheader"
      scope="col"
      aria-sort={sortKey === undefined ? undefined : active ? SORT_NAMES[sort.order] : 'none'}
      className={cn(
        'px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-ink-muted',
        column.visibleFrom === 'xl' ? 'hidden @6xl:table-cell' : 'table-cell',
        column.align === 'end' && 'text-right',
        column.className,
      )}
    >
      {sortKey !== undefined && onSortChange ? (
        <button
          type="button"
          onClick={() => onSortChange(sortKey)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md hover:text-ink',
            active && 'text-ink',
          )}
        >
          {column.header}
          <SortIcon aria-hidden="true" size={14} className={cn(!active && 'opacity-50')} />
        </button>
      ) : (
        column.header
      )}
    </th>
  );
};

const RowView = <T, S extends string>({
  row,
  columns,
}: {
  row: T;
  columns: readonly TableColumn<T, S>[];
}) => (
  <tr role="row" className={ROW_CLASSES}>
    {columns.map((column) => (
      <td
        key={column.id}
        role="cell"
        data-label={column.header}
        className={cn(
          cellDisplay(column.visibleFrom),
          'items-start justify-between gap-4 py-1 text-sm text-ink @3xl:px-4 @3xl:py-3 @3xl:align-middle',
          !column.primary &&
            !column.hideLabelOnMobile &&
            'before:shrink-0 before:font-semibold before:text-ink-muted before:content-[attr(data-label)] @3xl:before:content-none',
          column.primary && 'text-base @max-3xl:order-first @max-3xl:pb-2',
          column.align === 'end' && '@3xl:text-right',
          column.className,
        )}
      >
        {column.cell(row)}
      </td>
    ))}
  </tr>
);

// A row re-renders only when its row object changes. TanStack Query keeps unchanged rows
// identical across refetches, so a refetch or a live update re-renders just the rows that differ.
const Row = memo(RowView) as typeof RowView;

/**
 * A data table that turns into a list of cards when its container is narrower than 48rem: one
 * DOM, restyled. A container query, not a viewport one, so it adapts to the space it is given. The explicit ARIA
 * roles keep the table semantics that some browsers drop when a table's display changes.
 */
export const Table = <T, S extends string = string>({
  caption,
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  loading = false,
  refreshing = false,
  empty,
  skeletonRows = 5,
}: TableProps<T, S>) => (
  <div
    className={cn(
      '@container overflow-hidden rounded-xl border border-line bg-paper transition-opacity',
      refreshing && 'opacity-70',
    )}
  >
    <table
      role="table"
      aria-busy={loading || refreshing || undefined}
      className="block w-full border-collapse text-left @3xl:table"
    >
      <caption className="sr-only">{caption}</caption>
      <thead role="rowgroup" className="@max-3xl:sr-only">
        <tr role="row" className="border-b border-line bg-canvas/60">
          {columns.map((column) => (
            <HeaderCell key={column.id} column={column} sort={sort} onSortChange={onSortChange} />
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup" className="block @3xl:table-row-group">
        {loading
          ? Array.from({ length: skeletonRows }, (_, index) => (
              <tr key={index} role="row" className={ROW_CLASSES}>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    role="cell"
                    className={cn(cellDisplay(column.visibleFrom), 'py-1.5 @3xl:px-4 @3xl:py-3.5')}
                  >
                    <Skeleton className="h-4 w-full max-w-36" />
                  </td>
                ))}
              </tr>
            ))
          : null}
        {!loading && rows.length === 0 ? (
          <tr role="row" className="block @3xl:table-row">
            <td role="cell" colSpan={columns.length} className="block @3xl:table-cell">
              {empty}
            </td>
          </tr>
        ) : null}
        {!loading ? rows.map((row) => <Row key={rowKey(row)} row={row} columns={columns} />) : null}
      </tbody>
    </table>
  </div>
);
