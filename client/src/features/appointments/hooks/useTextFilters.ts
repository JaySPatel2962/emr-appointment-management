import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppointmentListParams } from '@/features/appointments/api';
import { parseTextFilter, TEXT_FILTERS } from '@/features/appointments/utils/list-params';
import type { TextFilter } from '@/features/appointments/utils/list-params';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';

export type TextFilterValues = Readonly<Record<TextFilter, string>>;

const TYPING_DELAY_MS = 350;

const EMPTY: TextFilterValues = { patientName: '', mobile: '', doctorName: '' };

const fromParams = (params: AppointmentListParams): TextFilterValues => ({
  patientName: params.patientName ?? '',
  mobile: params.mobile ?? '',
  doctorName: params.doctorName ?? '',
});

/**
 * The list's search boxes. What is typed shows at once; the URL, and so the request, follows
 * once typing pauses, with every box edited during that pause. When the URL changes some other
 * way (the empty list's "Clear filters", a link to the plain list), the boxes show its filters.
 */
export const useTextFilters = (
  params: AppointmentListParams,
  onChange: (patch: Partial<AppointmentListParams>) => void,
) => {
  const inUrl = fromParams(params);
  const [text, setText] = useState<TextFilterValues>(inUrl);
  // The URL's filters as of the last render, and what this hook last sent there, to tell the
  // URL catching up with the boxes from a change made elsewhere.
  const [seen, setSeen] = useState<TextFilterValues>(inUrl);
  const [sent, setSent] = useState<TextFilterValues>(inUrl);
  const unsent = useRef<Partial<Record<TextFilter, string>>>({});
  const latestText = useRef(text);

  useEffect(() => {
    latestText.current = text;
  });

  if (TEXT_FILTERS.some((key) => inUrl[key] !== seen[key])) {
    const changedElsewhere = TEXT_FILTERS.filter(
      (key) => inUrl[key] !== seen[key] && inUrl[key] !== sent[key],
    );
    setSeen(inUrl);
    setSent(inUrl);
    if (changedElsewhere.length > 0) {
      setText((typed) => ({
        ...typed,
        ...Object.fromEntries(changedElsewhere.map((key) => [key, inUrl[key]])),
      }));
    }
  }

  const { run: sendSoon, cancel: cancelSend } = useDebouncedCallback(() => {
    const pending = unsent.current;
    unsent.current = {};
    // Only what the boxes still say: a box the URL overwrote meanwhile keeps the URL's value.
    const keys = TEXT_FILTERS.filter(
      (key) =>
        pending[key] !== undefined &&
        (parseTextFilter(key, latestText.current[key]) ?? '') === pending[key],
    );
    if (keys.length === 0) {
      return;
    }
    const values = Object.fromEntries(keys.map((key) => [key, pending[key] ?? '']));
    setSent((current) => ({ ...current, ...values }));
    const patch: Partial<AppointmentListParams> = {};
    for (const key of keys) {
      patch[key] = values[key] === '' ? undefined : values[key];
    }
    onChange(patch);
  }, TYPING_DELAY_MS);

  const change = useCallback(
    (key: TextFilter, value: string) => {
      setText((current) => ({ ...current, [key]: value }));
      unsent.current = { ...unsent.current, [key]: parseTextFilter(key, value) ?? '' };
      sendSoon();
    },
    [sendSoon],
  );

  /** Empties the boxes, and drops a search that is still waiting to be sent. */
  const clear = useCallback(() => {
    cancelSend();
    unsent.current = {};
    setText(EMPTY);
  }, [cancelSend]);

  return { text, change, clear };
};
