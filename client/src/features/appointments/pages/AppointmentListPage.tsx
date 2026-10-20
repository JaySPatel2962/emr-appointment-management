import { CalendarPlus, SearchX } from 'lucide-react';
import { useCallback } from 'react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { FormField } from '@/components/ui/FormField';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import type { AppointmentSortField } from '@/constants/appointment';
import { PAGE_SIZE_OPTIONS } from '@/constants/http';
import { FRONT_DESK_ROLES, ROLES } from '@/constants/roles';
import { ROUTES } from '@/constants/routes';
import { useCurrentUser } from '@/features/auth/hooks/useAuth';
import { AppointmentDialogsHost } from '@/features/appointments/components/AppointmentDialogsHost';
import { AppointmentFilters } from '@/features/appointments/components/AppointmentFilters';
import { AppointmentTable } from '@/features/appointments/components/AppointmentTable';
import { useAppointmentActions } from '@/features/appointments/hooks/useAppointmentActions';
import { useAppointmentDialogs } from '@/features/appointments/hooks/useAppointmentDialogs';
import { useAppointmentListParams } from '@/features/appointments/hooks/useAppointmentListParams';
import { useAppointmentList } from '@/features/appointments/queries';
import { hasActiveFilters } from '@/features/appointments/utils/list-params';
import type { SortOrder } from '@/types/api';
import type { Appointment } from '@/types/models';

interface SortChoice {
  value: string;
  label: string;
  sortBy: AppointmentSortField;
  sortOrder: SortOrder;
}

const sortChoice = (
  sortBy: AppointmentSortField,
  sortOrder: SortOrder,
  label: string,
): SortChoice => ({
  value: `${sortBy}:${sortOrder}`,
  label,
  sortBy,
  sortOrder,
});

// Every sort the column headers offer, for widths where some or all of them don't fit.
const SORT_CHOICES: readonly SortChoice[] = [
  sortChoice('date', 'asc', 'Date, earliest first'),
  sortChoice('date', 'desc', 'Date, latest first'),
  sortChoice('patientName', 'asc', 'Patient, A to Z'),
  sortChoice('patientName', 'desc', 'Patient, Z to A'),
  sortChoice('doctorName', 'asc', 'Doctor, A to Z'),
  sortChoice('doctorName', 'desc', 'Doctor, Z to A'),
  sortChoice('status', 'asc', 'Status, A to Z'),
  sortChoice('status', 'desc', 'Status, Z to A'),
  sortChoice('createdAt', 'desc', 'Booked, newest first'),
  sortChoice('createdAt', 'asc', 'Booked, oldest first'),
];

export const AppointmentListPage = () => {
  const user = useCurrentUser();
  const isDoctor = user.role === ROLES.DOCTOR;
  const frontDesk = FRONT_DESK_ROLES.includes(user.role);
  const { params, update, clearFilters } = useAppointmentListParams();
  const { data, isPending, isFetching, error, refetch, isRefetching } = useAppointmentList(params);
  const dialogs = useAppointmentDialogs();
  const actions = useAppointmentActions();
  const filtered = hasActiveFilters(params);

  const { showDetails, showEdit, showCancel } = dialogs;
  const { mutate: arrive } = actions.arrive;
  const { mutate: complete } = actions.complete;
  const onArrive = useCallback((id: string) => arrive(id), [arrive]);
  const onComplete = useCallback((id: string) => complete(id), [complete]);
  const onEdit = useCallback((appointment: Appointment) => showEdit(appointment), [showEdit]);
  const onCancel = useCallback((appointment: Appointment) => showCancel(appointment), [showCancel]);

  const onSortChange = useCallback(
    (by: AppointmentSortField) =>
      update({
        sortBy: by,
        sortOrder: params.sortBy === by && params.sortOrder === 'asc' ? 'desc' : 'asc',
      }),
    [update, params.sortBy, params.sortOrder],
  );

  const outOfRange =
    data !== undefined && data.meta.totalPages > 0 && params.page > data.meta.totalPages;

  return (
    <>
      <PageHeader
        title="Appointments"
        description={
          isDoctor
            ? 'Your appointments: check who is coming and add consultation notes.'
            : 'Find, check in and update appointments across the clinic.'
        }
        actions={
          frontDesk ? (
            <ButtonLink to={ROUTES.booking}>
              <CalendarPlus aria-hidden="true" size={18} />
              Book appointment
            </ButtonLink>
          ) : null
        }
      />

      <div className="@container flex flex-col gap-4">
        <AppointmentFilters
          params={params}
          onChange={update}
          onClear={clearFilters}
          showDoctorFilters={!isDoctor}
        />

        {/*
          The table shows cards, with no headers, below 48rem, and the Booked column from 72rem
          (inside its 1px border). Until every sortable header fits, sorting is a choice too.
        */}
        <div className="@min-[72.125rem]:hidden">
          <FormField label="Sort by">
            {(control) => (
              <Select
                {...control}
                options={SORT_CHOICES}
                value={`${params.sortBy}:${params.sortOrder}`}
                onChange={(event) => {
                  const choice = SORT_CHOICES.find((option) => option.value === event.target.value);
                  if (choice) {
                    update({ sortBy: choice.sortBy, sortOrder: choice.sortOrder });
                  }
                }}
              />
            )}
          </FormField>
        </div>

        {error ? (
          <ErrorMessage
            title="Couldn't load the appointments"
            error={error}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : (
          <>
            <p className="sr-only" role="status">
              {isPending ? 'Loading appointments' : ''}
            </p>
            <AppointmentTable
              appointments={outOfRange ? [] : (data?.items ?? [])}
              sort={{ by: params.sortBy, order: params.sortOrder }}
              onSortChange={onSortChange}
              onOpen={showDetails}
              onArrive={onArrive}
              onComplete={onComplete}
              onEdit={onEdit}
              onCancel={onCancel}
              loading={isPending}
              refreshing={isFetching && !isPending}
              empty={
                outOfRange ? (
                  <EmptyState
                    icon={SearchX}
                    title={`There is no page ${String(params.page)}`}
                    description="The list got shorter since this link was made."
                    action={
                      <Button onClick={() => update({ page: 1 })}>Go to the first page</Button>
                    }
                  />
                ) : filtered ? (
                  <EmptyState
                    icon={SearchX}
                    title="No appointments match these filters"
                    description="Check the spelling, or widen the dates."
                    action={
                      <Button variant="secondary" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={CalendarPlus}
                    title="No appointments yet"
                    description={
                      frontDesk
                        ? 'Booked appointments appear here.'
                        : 'Appointments booked with you appear here.'
                    }
                    action={
                      frontDesk ? (
                        <ButtonLink to={ROUTES.booking}>Book an appointment</ButtonLink>
                      ) : null
                    }
                  />
                )
              }
            />
          </>
        )}

        {data && data.meta.total > 0 && !outOfRange ? (
          <Pagination
            page={params.page}
            totalPages={data.meta.totalPages}
            total={data.meta.total}
            limit={params.limit}
            itemLabel="appointments"
            limitOptions={PAGE_SIZE_OPTIONS}
            onPageChange={(page) => update({ page })}
            onLimitChange={(limit) => update({ limit })}
          />
        ) : null}
      </div>

      <AppointmentDialogsHost dialogs={dialogs} actions={actions} />
    </>
  );
};
