import { Select } from '@/components/ui/Select';
import type { Doctor } from '@/types/models';

export interface DoctorSelectProps {
  id?: string | undefined;
  'aria-describedby'?: string | undefined;
  'aria-invalid'?: true | undefined;
  doctors: readonly Doctor[];
  value: string | null;
  onChange: (doctorId: string | null) => void;
  /** Adds the department to each name, when the list spans departments. */
  showDepartment?: boolean | undefined;
  disabled?: boolean | undefined;
}

export const DoctorSelect = ({
  doctors,
  value,
  onChange,
  showDepartment = false,
  ...rest
}: DoctorSelectProps) => (
  <Select
    {...rest}
    placeholder="Choose a doctor"
    options={doctors.map((doctor) => ({
      value: doctor.id,
      label: showDepartment ? `${doctor.name} (${doctor.department.name})` : doctor.name,
    }))}
    value={value ?? ''}
    onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
  />
);
