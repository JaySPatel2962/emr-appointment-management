import { useCallback, useState } from 'react';

import type { Appointment, AppointmentSummary } from '@/types/models';

/** What the edit form needs: the editable fields and enough context to describe the visit. */
export type EditableAppointment = Pick<
  Appointment,
  'id' | 'purpose' | 'notes' | 'status' | 'doctor' | 'patient' | 'date' | 'slotStart'
>;

export type AppointmentDialog =
  | { kind: 'details'; id: string }
  | { kind: 'edit'; appointment: EditableAppointment }
  | { kind: 'cancel'; appointment: AppointmentSummary }
  | null;

/** Which appointment dialog is open. One at a time, so dialogs never stack. */
export const useAppointmentDialogs = () => {
  const [dialog, setDialog] = useState<AppointmentDialog>(null);

  const showDetails = useCallback((id: string) => setDialog({ kind: 'details', id }), []);
  const showEdit = useCallback(
    (appointment: EditableAppointment) => setDialog({ kind: 'edit', appointment }),
    [],
  );
  const showCancel = useCallback(
    (appointment: AppointmentSummary) => setDialog({ kind: 'cancel', appointment }),
    [],
  );
  const close = useCallback(() => setDialog(null), []);

  return { dialog, showDetails, showEdit, showCancel, close };
};

export type AppointmentDialogs = ReturnType<typeof useAppointmentDialogs>;
