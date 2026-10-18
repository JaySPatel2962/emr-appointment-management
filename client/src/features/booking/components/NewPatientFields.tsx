import type { FieldErrors, UseFormRegister } from 'react-hook-form';

import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { GENDER_LABELS, GENDERS, NAME_MAX_LENGTH } from '@/constants/patient';
import type { BookingFormValues } from '@/features/booking/schemas';
import { useClinicClock } from '@/hooks/useClinicClock';

const GENDER_OPTIONS = Object.values(GENDERS).map((gender) => ({
  value: gender,
  label: GENDER_LABELS[gender],
}));

export interface NewPatientFieldsProps {
  register: UseFormRegister<BookingFormValues>;
  errors: FieldErrors<BookingFormValues>;
}

/** A patient registered as part of the booking: one transaction, so a failed booking leaves no record. */
export const NewPatientFields = ({ register, errors }: NewPatientFieldsProps) => {
  const { date: today } = useClinicClock();
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
