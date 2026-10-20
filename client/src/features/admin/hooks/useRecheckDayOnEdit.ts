import { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import type { ScheduleFormOutput, ScheduleFormValues } from '@/features/admin/schemas';

const DAY_FIELD = /^days\.(\d+)(?:\.|$)/;

/**
 * Once a day shows a problem, its messages follow the user's edits. The problems (overlapping
 * ranges, a break outside working hours) belong to a whole range or list, and react-hook-form
 * re-checks only the field that changed, so a fixed overlap kept its message until the next
 * save. A day that shows no problem still waits for the save, so half-typed times aren't
 * flagged while they're being entered.
 */
export const useRecheckDayOnEdit = (
  form: UseFormReturn<ScheduleFormValues, unknown, ScheduleFormOutput>,
) => {
  const { subscribe, getFieldState, trigger } = form;
  useEffect(
    () =>
      subscribe({
        formState: { values: true },
        callback: ({ name }) => {
          const day = name?.match(DAY_FIELD)?.[1];
          if (day === undefined) return;
          const path = `days.${Number(day)}` as const;
          if (getFieldState(path).error) {
            void trigger(path);
          }
        },
      }),
    [subscribe, getFieldState, trigger],
  );
};
