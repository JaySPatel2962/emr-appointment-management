import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Table } from '@/components/ui/Table';
import type { TableColumn } from '@/components/ui/Table';

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = Array.from({ length: 20 }, (_, index) => ({
  id: `r${String(index)}`,
  name: `Patient ${String(index)}`,
}));

const rowKey = (row: Row) => row.id;

describe('Table', () => {
  it('marks the sorted column and asks to sort by another', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const columns: TableColumn<Row, 'name' | 'id'>[] = [
      { id: 'name', header: 'Name', sortKey: 'name', cell: (row) => row.name },
      { id: 'id', header: 'Id', sortKey: 'id', cell: (row) => row.id },
    ];
    render(
      <Table
        caption="Patients"
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        sort={{ by: 'name', order: 'desc' }}
        onSortChange={onSortChange}
      />,
    );

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: /Id/ })).toHaveAttribute('aria-sort', 'none');
    await user.click(screen.getByRole('button', { name: 'Id' }));
    expect(onSortChange).toHaveBeenCalledWith('id');
  });

  it('shows the empty state instead of rows', () => {
    render(
      <Table
        caption="Patients"
        columns={[{ id: 'name', header: 'Name', cell: (row: Row) => row.name }]}
        rows={[]}
        rowKey={rowKey}
        empty={<p>No patients yet</p>}
      />,
    );

    expect(screen.getByText('No patients yet')).toBeInTheDocument();
  });

  it('re-renders only the rows whose data changed', () => {
    const cell = vi.fn((row: Row) => row.name);
    const columns: TableColumn<Row>[] = [{ id: 'name', header: 'Name', cell }];
    const { rerender } = render(
      <Table caption="Patients" columns={columns} rows={rows} rowKey={rowKey} />,
    );
    expect(cell).toHaveBeenCalledTimes(20);
    cell.mockClear();

    // A refetch where one row changed: TanStack Query keeps the other 19 objects as they were.
    const refetched = rows.map((row) =>
      row.id === 'r7' ? { ...row, name: 'Patient 7, arrived' } : row,
    );
    rerender(<Table caption="Patients" columns={columns} rows={refetched} rowKey={rowKey} />);

    expect(cell).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Patient 7, arrived')).toBeInTheDocument();
  });
});
