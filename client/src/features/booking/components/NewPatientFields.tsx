import { useWatch } from 'react-hook-form';
import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';

import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { GENDER_LABELS, GENDERS, NAME_MAX_LENGTH } from '@/constants/patient';
import { MobileMatches } from '@/features/booking/components/MobileMatches';
import type { BookingFormValues } from '@/features/booking/schemas';
import { useMobileMatches } from '@/features/patients/queries';
import { useClinicClock } from '@/hooks/useClinicClock';
import type { Patient } from '@/types/models';

const GENDER_OPTIONS = Object.values(GENDERS).map((gender) => ({
  value: gender,
  label: GENDER_LABELS[gender],
}));

export interface NewPatientFieldsProps {
  register: UseFormRegister<BookingFormValues>;
  errors: FieldErrors<BookingFormValues>;
  control: Control<BookingFormValues>;
  /** Book for a registered patient with the same mobile number instead. */
  onChooseExisting: (patient: Patient) => void;
}

/** A patient registered as part of the booking: one transaction, so a failed booking leaves no record. */
export const NewPatientFields = ({
  register,
  errors,
  control,
  onChooseExisting,
}: NewPatientFieldsProps) => {
  const { date: today } = useClinicClock();
  const mobile = useWatch({ control, name: 'newPatient.mobile' });
  const matches = useMobileMatches(mobile);
  const fieldErrors = errors.newPatient;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Full name" error={fieldErrors?.name?.message} className="sm:col-span-2">
        {(control) => (
          <Input
            {...control}
            {...register('newPatient.name')}
            autoComplete="off"
            maxLength={NAME_MAX_LENGTH}
          />
        )}
      </FormField>
      <FormField
        label="Mobile number"
        hint="10 digits; +91 is optional"
        error={fieldErrors?.mobile?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...register('newPatient.mobile')}
            type="tel"
            inputMode="tel"
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField label="Date of birth" optional error={fieldErrors?.dateOfBirth?.message}>
        {(control) => (
          <Input {...control} {...register('newPatient.dateOfBirth')} type="date" max={today} />
        )}
      </FormField>
      {matches.total > 0 ? (
        <div className="sm:col-span-2">
          <MobileMatches matches={matches} onChoose={onChooseExisting} />
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <RadioGroup
          legend="Gender"
          variant="segmented"
          options={GENDER_OPTIONS}
          error={fieldErrors?.gender?.message}
          {...register('newPatient.gender')}
        />
      </div>
    </div>
  );
};
