import { useState } from 'react';
import { useWatch } from 'react-hook-form';

import { PageHeader } from '@/components/layout/PageHeader';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { Textarea } from '@/components/ui/Textarea';
import { NOTES_MAX_LENGTH, PURPOSE_MAX_LENGTH } from '@/constants/appointment';
import { BookingTimeSection } from '@/features/booking/components/BookingTimeSection';
import { NewPatientFields } from '@/features/booking/components/NewPatientFields';
import { PatientSearch } from '@/features/booking/components/PatientSearch';
import { useBookingForm } from '@/features/booking/hooks/useBookingForm';
import type { PatientMode } from '@/features/booking/schemas';
import { useDoctor } from '@/features/doctors/queries';
import { useSchedulerRoom } from '@/features/scheduler/hooks/useSchedulerRoom';
import { useSlotSearch } from '@/features/slots/hooks/useSlotSearch';
import type { Patient } from '@/types/models';
import { formatDateWithWeekday } from '@/utils/date';
import { errorMessage } from '@/utils/form-errors';

const PATIENT_MODE_OPTIONS: readonly { value: PatientMode; label: string }[] = [
  { value: 'existing', label: 'Existing patient' },
  { value: 'new', label: 'New patient' },
];

export const BookingPage = () => {
  const { today, update, ...selection } = useSlotSearch();
  const { doctorId, date, slot } = selection;
  const { data: doctor } = useDoctor(doctorId);
  const [patient, setPatient] = useState<Patient | null>(null);
  // Keeps the slot picker current while the form is open: someone may book a slot meanwhile.
  useSchedulerRoom(doctorId, date);

  const { form, submit, submitting, error, slotProblem, slotMissing } = useBookingForm({
    doctorId,
    date,
    slot,
    onSlotLost: () => update({ slot: null }),
  });
  const {
    register,
    setValue,
    control,
    formState: { errors, isSubmitted },
  } = form;
  const patientMode = useWatch({ control, name: 'patientMode' });

  const choosePatient = (next: Patient | null) => {
    setPatient(next);
    setValue('patientId', next?.id ?? '', { shouldValidate: isSubmitted });
  };

  const registerNew = (prefill: { name: string; mobile: string }) => {
    setValue('patientMode', 'new');
    setValue('newPatient.name', prefill.name);
    setValue('newPatient.mobile', prefill.mobile);
  };

  return (
    <>
      <PageHeader
        title="Book an appointment"
        description="Choose a time, then the patient. A new patient is registered with the booking."
      />

      <form
        noValidate
        onSubmit={submit}
        className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
      >
        <Panel title="Time">
          <BookingTimeSection
            selection={selection}
            today={today}
            onChange={update}
            slotProblem={slotProblem}
            slotMissing={slotMissing}
          />
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel title="Patient">
            <div className="flex flex-col gap-4">
              <RadioGroup
                legend="Who is the appointment for?"
                hideLegend
                variant="segmented"
                options={PATIENT_MODE_OPTIONS}
                {...register('patientMode')}
              />
              {patientMode === 'existing' ? (
                <PatientSearch
                  selected={patient}
                  onSelect={choosePatient}
                  onRegister={registerNew}
                  error={errors.patientId?.message}
                />
              ) : (
                <NewPatientFields register={register} errors={errors} />
              )}
            </div>
          </Panel>

          <Panel title="Visit">
            <div className="flex flex-col gap-4">
              <FormField
                label="Purpose of the visit"
                hint="For example: follow-up after ECG"
                error={errors.purpose?.message}
              >
                {(control) => (
                  <Input {...control} {...register('purpose')} maxLength={PURPOSE_MAX_LENGTH} />
                )}
              </FormField>
              <FormField label="Notes" optional error={errors.notes?.message}>
                {(control) => (
                  <Textarea
                    {...control}
                    {...register('notes')}
                    rows={3}
                    maxLength={NOTES_MAX_LENGTH}
                  />
                )}
              </FormField>
            </div>
          </Panel>

          <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-5">
            {error ? <Alert tone="error">{errorMessage(error)}</Alert> : null}
            <p className="text-sm text-ink-muted" aria-live="polite">
              {doctor && slot ? (
                <>
                  <span className="font-semibold text-ink">{doctor.name}</span>,{' '}
                  {formatDateWithWeekday(date)} at{' '}
                  <span className="font-semibold text-ink tabular-nums">{slot}</span>
                </>
              ) : (
                'Choose a doctor, a day and a time.'
              )}
            </p>
            <Button type="submit" fullWidth loading={submitting}>
              Book appointment
            </Button>
          </div>
        </div>
      </form>
    </>
  );
};
