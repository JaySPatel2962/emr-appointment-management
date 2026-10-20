import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import type { MobileMatches as Matches } from '@/features/patients/queries';
import { patientSummary } from '@/features/patients/utils/summary';
import { useClinicClock } from '@/hooks/useClinicClock';
import type { Patient } from '@/types/models';

export interface MobileMatchesProps {
  matches: Matches;
  /** Book for this registered patient instead of registering a new one. */
  onChoose: (patient: Patient) => void;
}

const countLine = ({ patients, total }: Matches): string => {
  const shown = total > patients.length ? ` Showing ${String(patients.length)} of them.` : '';
  return total === 1
    ? 'A registered patient has this mobile number.'
    : `${String(total)} registered patients have this mobile number.${shown}`;
};

/** "Is it one of these?": the patients already registered with the mobile number typed. */
export const MobileMatches = ({ matches, onChoose }: MobileMatchesProps) => {
  const { date: today } = useClinicClock();

  return (
    <Alert tone="info" title="Is it one of these?">
      <p>
        {countLine(matches)} Choose one to book for them, or carry on to register a new patient.
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {matches.patients.map((patient) => (
          <li
            key={patient.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-paper p-2.5"
          >
            <span className="min-w-0">
              <span className="block font-semibold wrap-anywhere text-ink">{patient.name}</span>
              <span className="block text-xs tabular-nums">{patientSummary(patient, today)}</span>
            </span>
            <Button variant="secondary" size="sm" onClick={() => onChoose(patient)}>
              Choose <span className="sr-only">{patient.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </Alert>
  );
};
