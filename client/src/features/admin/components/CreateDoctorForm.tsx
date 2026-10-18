import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { useForm } from 'react-hook-form';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Select';
import { SPECIALIZATION_MAX_LENGTH } from '@/constants/doctor';
import { HTTP_STATUS } from '@/constants/http';
import { AccountFields } from '@/features/admin/components/AccountFields';
import { ScheduleEditor } from '@/features/admin/components/ScheduleEditor';
import { useCreateDoctor } from '@/features/admin/hooks/useAdminMutations';
import {
  accountSchema,
  doctorDetailsSchema,
  scheduleFormDefaults,
  scheduleFormSchema,
} from '@/features/admin/schemas';
import type {
  AccountFormOutput,
  AccountFormValues,
  DoctorDetailsOutput,
  DoctorDetailsValues,
  ScheduleFormOutput,
  ScheduleFormValues,
} from '@/features/admin/schemas';
import { applyAccountErrors } from '@/features/admin/utils/account-errors';
import { scheduleFieldPath, standardWeek, toSchedule } from '@/features/admin/utils/schedule-form';
import { useDepartments } from '@/features/departments/queries';
import { hasStatus } from '@/services/api-error';
import type { Doctor } from '@/types/models';
import { applyServerFieldErrors, errorMessage } from '@/utils/form-errors';

const DEFAULT_SLOT_MINUTES = 15;

export interface CreateDoctorFormProps {
  /** Called with the new doctor, to show them in the schedules list. */
  onCreated: (doctor: Doctor) => void;
}

/**
 * A doctor's login, profile and weekly schedule, saved together. The three parts are separate
 * forms (each typed exactly), validated together on submit.
 */
export const CreateDoctorForm = ({ onCreated }: CreateDoctorFormProps) => {
  const account = useForm<AccountFormValues, unknown, AccountFormOutput>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', email: '', password: '' },
    mode: 'onTouched',
  });
  const details = useForm<DoctorDetailsValues, unknown, DoctorDetailsOutput>({
    resolver: zodResolver(doctorDetailsSchema),
    defaultValues: { departmentId: '', specialization: '' },
    mode: 'onTouched',
  });
  const schedule = useForm<ScheduleFormValues, unknown, ScheduleFormOutput>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: scheduleFormDefaults(DEFAULT_SLOT_MINUTES, standardWeek()),
    mode: 'onTouched',
  });
  const { data: departments = [] } = useDepartments();
  const { mutate, isPending } = useCreateDoctor();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGeneralError(null);
    // Validate every part, focusing the first problem in reading order.
    const accountValid = await account.trigger(undefined, { shouldFocus: true });
    const detailsValid = await details.trigger(undefined, { shouldFocus: accountValid });
    const scheduleValid = await schedule.trigger(undefined, {
      shouldFocus: accountValid && detailsValid,
    });
    if (!accountValid || !detailsValid || !scheduleValid) {
      return;
    }
    const scheduleValues = scheduleFormSchema.parse(schedule.getValues());
    mutate(
      {
        ...accountSchema.parse(account.getValues()),
        ...doctorDetailsSchema.parse(details.getValues()),
        slotDurationMinutes: scheduleValues.slotDurationMinutes,
        schedule: toSchedule(scheduleValues.days),
      },
      {
        onSuccess: (doctor) => {
          account.reset();
          details.reset();
          schedule.reset();
          onCreated(doctor);
        },
        onError: (error) => {
          if (hasStatus(error, HTTP_STATUS.UNPROCESSABLE)) {
            details.setError('departmentId', { type: 'server', message: error.message });
            return;
          }
          const onAccount = applyAccountErrors(error, account.setError);
          const onDetails = applyServerFieldErrors(error, details.setError, (field) => {
            const name = field.replace(/^body\./, '');
            return name === 'departmentId' || name === 'specialization' ? name : null;
          });
          const onSchedule = applyServerFieldErrors(
            error,
            schedule.setError,
            scheduleFieldPath(scheduleValues.days),
          );
          if (!onAccount && !onDetails && !onSchedule) {
            setGeneralError(errorMessage(error));
          }
        },
      },
    );
  };

  const {
    register,
    formState: { errors },
  } = details;

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
      {generalError ? <Alert tone="error">{generalError}</Alert> : null}
      <Panel title="Account" description="What the doctor logs in with.">
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <AccountFields form={account} />
        </div>
      </Panel>
      <Panel title="Profile">
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <FormField label="Department" error={errors.departmentId?.message}>
            {(control) => (
              <Select
                {...control}
                {...register('departmentId')}
                placeholder="Choose a department"
                options={departments.map((department) => ({
                  value: department.id,
                  label: department.name,
                }))}
              />
            )}
          </FormField>
          <FormField
            label="Specialization"
            hint="For example: interventional cardiology"
            error={errors.specialization?.message}
          >
            {(control) => (
              <Input
                {...control}
                {...register('specialization')}
                maxLength={SPECIALIZATION_MAX_LENGTH}
                autoComplete="off"
              />
            )}
          </FormField>
        </div>
      </Panel>
      <Panel
        title="Weekly schedule"
        description="A standard week is filled in. Change the days and hours to match this doctor."
      >
        <ScheduleEditor form={schedule} />
      </Panel>
      <div>
        <Button type="submit" loading={isPending}>
          Add doctor
        </Button>
      </div>
    </form>
  );
};
