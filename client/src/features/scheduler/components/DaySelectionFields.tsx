import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { useDepartments } from '@/features/departments/queries';
import { DoctorSelect } from '@/features/doctors/components/DoctorSelect';
import { useDoctors } from '@/features/doctors/queries';
import { worksOn } from '@/features/doctors/utils/schedule';
import { DayNavigator } from '@/features/slots/components/DayNavigator';
import type { SlotSearch } from '@/features/slots/utils/slot-search';
import type { Doctor } from '@/types/models';

export interface DaySelectionFieldsProps {
  selection: SlotSearch;
  today: string;
  /** The chosen doctor, once loaded: their days off are greyed out in the calendar. */
  doctor: Doctor | undefined;
  /** Doctors only ever see their own day, so they get just the date. */
  canChooseDoctor: boolean;
  onChange: (patch: Partial<SlotSearch>) => void;
  doctorError?: string | undefined;
}

/**
 * Department, doctor and date: which day sheet to show. Shared by the scheduler and the booking
 * form. Changing the doctor or the date drops a chosen slot, which belonged to the old day.
 */
export const DaySelectionFields = ({
  selection,
  today,
  doctor,
  canChooseDoctor,
  onChange,
  doctorError,
}: DaySelectionFieldsProps) => {
  const { departmentId, doctorId, date } = selection;
  const { data: departments = [] } = useDepartments();
  const doctorsQuery = useDoctors(departmentId ? { departmentId } : {});
  const doctors = doctorsQuery.data ?? [];

  // A container query, not a viewport one: the same fields sit in a wide panel (the scheduler)
  // and in a narrow column (the booking form).
  return (
    <div className="@container">
      <div
        className={
          canChooseDoctor ? 'grid gap-4 @xl:grid-cols-2 @4xl:grid-cols-[1fr_1fr_1.4fr]' : ''
        }
      >
        {canChooseDoctor ? (
          <>
            <FormField label="Department">
              {(control) => (
                <Select
                  {...control}
                  placeholder="All departments"
                  options={departments.map((department) => ({
                    value: department.id,
                    label: department.name,
                  }))}
                  value={departmentId ?? ''}
                  onChange={(event) => {
                    const next = event.target.value === '' ? null : event.target.value;
                    // A doctor from another department no longer fits the filter.
                    const keepDoctor = next === null || doctor?.department.id === next;
                    onChange({
                      departmentId: next,
                      ...(keepDoctor ? {} : { doctorId: null }),
                      slot: null,
                    });
                  }}
                />
              )}
            </FormField>
            <FormField
              label="Doctor"
              error={doctorError}
              hint={doctorsQuery.isPending ? 'Loading doctors' : undefined}
            >
              {(control) => (
                <DoctorSelect
                  {...control}
                  doctors={doctors}
                  value={doctorId}
                  showDepartment={departmentId === null}
                  onChange={(next) => onChange({ doctorId: next, slot: null })}
                />
              )}
            </FormField>
          </>
        ) : null}
        <FormField label="Date">
          {(control) => (
            <DayNavigator
              {...control}
              date={date}
              today={today}
              isDateDisabled={doctor ? (candidate) => !worksOn(doctor, candidate) : undefined}
              onChange={(next) => onChange({ date: next, slot: null })}
            />
          )}
        </FormField>
      </div>
    </div>
  );
};
