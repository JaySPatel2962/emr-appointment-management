import { RotateCcw } from 'lucide-react';

import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';

export interface StaleScheduleAlertProps {
  /** The API's message: the schedule changed since this form loaded it. */
  message: string;
  onReload: () => void;
  reloading: boolean;
}

/** Why a save was refused, when someone else saved the schedule first, and the way out. */
export const StaleScheduleAlert = ({ message, onReload, reloading }: StaleScheduleAlertProps) => (
  <Alert
    tone="warning"
    title={message}
    action={
      <Button variant="secondary" size="sm" loading={reloading} onClick={onReload}>
        <RotateCcw aria-hidden="true" size={15} />
        Reload schedule
      </Button>
    }
  >
    <p>
      Reloading shows the schedule as it is saved now and drops the changes made here. Make them
      again, then save.
    </p>
  </Alert>
);
