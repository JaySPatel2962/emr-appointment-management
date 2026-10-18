import { UserPlus, UserRound } from 'lucide-react';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { GENDER_LABELS } from '@/constants/patient';
import { usePatientSearch } from '@/features/patients/queries';
import { formatMobile } from '@/features/patients/utils/mobile';
import { useClinicClock } from '@/hooks/useClinicClock';
import type { Patient } from '@/types/models';
import { ageOn } from '@/utils/date';

/** What a search term says about a new patient: digits are a mobile number, words a name. */
const prefillFrom = (term: string): { name: string; mobile: string } => {
  if (/^PAT-/i.test(term)) {
    return { name: '', mobile: '' };
  }
  return /^[+\d\s().-]+$/.test(term) ? { name: '', mobile: term } : { name: term, mobile: '' };
};

const describe = (patient: Patient, today: string): string =>
  [
    patient.patientCode,
    formatMobile(patient.mobile),
    GENDER_LABELS[patient.gender],
    patient.dateOfBirth ? `${String(ageOn(patient.dateOfBirth, today))} years` : null,
  ]
    .filter(Boolean)
    .join(', ');

export interface PatientSearchProps {
  selected: Patient | null;
  onSelect: (patient: Patient | null) => void;
  /** Switch to registering a new patient, with what was searched for filled in. */
  onRegister: (prefill: { name: string; mobile: string }) => void;
  error?: string | undefined;
}

/** Finds a registered patient by patient ID, mobile number or name, as the user types. */
export const PatientSearch = ({ selected, onSelect, onRegister, error }: PatientSearchProps) => {
  const [input, setInput] = useState('');
  const { query, term, searching, typing } = usePatientSearch(input);
  const { date: today } = useClinicClock();
  const resultsName = useId();
  const results = query.data?.items ?? [];
  const total = query.data?.meta.total ?? 0;
  const busy = typing || query.isFetching;

  if (selected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-carbon/30 bg-carbon-soft p-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserRound aria-hidden="true" size={20} className="shrink-0 text-carbon" />
          <div className="min-w-0">
            <p className="font-semibold text-ink">{selected.name}</p>
            <p className="text-xs text-ink-muted tabular-nums">{describe(selected, today)}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onSelect(null)}>
          Change patient
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <FormField
        label="Find the patient"
        hint="Their patient ID (PAT-000042), the start of their mobile number, or the start of their name"
        error={error}
      >
        {(control) => (
          <Input
            {...control}
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        )}
      </FormField>

      <div aria-live="polite" className="text-sm text-ink-muted">
        {searching && busy ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size="sm" /> Searching
          </span>
        ) : null}
        {searching && !busy && query.isSuccess ? (
          results.length === 0 ? (
            <span>No registered patient matches “{term}”.</span>
          ) : (
            <span>
              {total > results.length
                ? `Showing ${String(results.length)} of ${String(total)} matches. Type more to narrow them down.`
                : `${String(total)} ${total === 1 ? 'patient matches' : 'patients match'}.`}
            </span>
          )
        ) : null}
        {query.isError ? <span className="text-vermilion">{query.error.message}</span> : null}
      </div>

      {results.length > 0 ? (
        <fieldset>
          <legend className="sr-only">Matching patients</legend>
          <ul className="flex flex-col gap-2">
            {results.map((patient) => (
              <li key={patient.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line-strong bg-paper p-3 hover:bg-canvas has-focus-visible:outline-2 has-focus-visible:outline-carbon">
                  <input
                    type="radio"
                    name={resultsName}
                    value={patient.id}
                    onChange={() => onSelect(patient)}
                    className="mt-1 size-4 shrink-0 accent-carbon"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{patient.name}</span>
                    <span className="block text-xs text-ink-muted tabular-nums">
                      {describe(patient, today)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      {searching && !busy && query.isSuccess && results.length === 0 ? (
        <div>
          <Button variant="secondary" onClick={() => onRegister(prefillFrom(term))}>
            <UserPlus aria-hidden="true" size={16} />
            Register a new patient
          </Button>
        </div>
      ) : null}
    </div>
  );
};
