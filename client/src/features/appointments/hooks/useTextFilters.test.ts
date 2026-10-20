import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppointmentListParams } from '@/features/appointments/api';
import { useTextFilters } from '@/features/appointments/hooks/useTextFilters';
import { DEFAULT_LIST_PARAMS } from '@/features/appointments/utils/list-params';

const PAUSE_MS = 350;

const paramsWith = (filters: Partial<AppointmentListParams> = {}): AppointmentListParams => ({
  ...DEFAULT_LIST_PARAMS,
  ...filters,
});

const setup = (filters: Partial<AppointmentListParams> = {}) => {
  const onChange = vi.fn();
  const hook = renderHook(({ params }) => useTextFilters(params, onChange), {
    initialProps: { params: paramsWith(filters) },
  });
  const pause = () => {
    act(() => {
      vi.advanceTimersByTime(PAUSE_MS);
    });
  };
  return { ...hook, onChange, pause };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTextFilters', () => {
  it('shows what is typed at once, and sends it once typing pauses', () => {
    const { result, onChange, pause } = setup();
    act(() => {
      result.current.change('patientName', 'As');
      result.current.change('patientName', 'Asha ');
    });

    expect(result.current.text.patientName).toBe('Asha ');
    expect(onChange).not.toHaveBeenCalled();
    pause();
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ patientName: 'Asha' });
  });

  it('sends every box edited during one pause together', () => {
    const { result, onChange, pause } = setup();
    act(() => {
      result.current.change('patientName', 'Asha');
      result.current.change('doctorName', 'Kavya');
    });
    pause();

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ patientName: 'Asha', doctorName: 'Kavya' });
  });

  it('sends an emptied box, or one the list cannot search by, as no filter', () => {
    const { result, onChange, pause } = setup({ patientName: 'Asha' });
    act(() => {
      result.current.change('patientName', '');
      result.current.change('mobile', 'abc');
    });
    pause();

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ patientName: undefined, mobile: undefined });
    expect(result.current.text.mobile).toBe('abc');
  });

  // Found in manual QA: separators alone matched every appointment.
  it('sends a mobile box with separators but no digit as no filter', () => {
    const { result, onChange, pause } = setup({ mobile: '98765' });
    act(() => {
      result.current.change('mobile', '--');
    });
    pause();

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ mobile: undefined });
  });

  it('clearing empties the boxes and drops a search still waiting to be sent', () => {
    const { result, onChange, pause } = setup({ doctorName: 'Rao' });
    act(() => {
      result.current.change('patientName', 'Asha');
    });
    act(() => {
      result.current.clear();
    });
    pause();

    expect(result.current.text).toEqual({ patientName: '', mobile: '', doctorName: '' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the filters of a URL that changed elsewhere', () => {
    const { result, rerender } = setup({ patientName: 'Asha', mobile: '98765' });
    rerender({ params: paramsWith({ mobile: '91234' }) });

    expect(result.current.text).toEqual({ patientName: '', mobile: '91234', doctorName: '' });
  });

  it('keeps newer typing when the URL catches up with an earlier pause', () => {
    const { result, rerender, onChange, pause } = setup();
    act(() => {
      result.current.change('patientName', 'Asha');
    });
    pause();
    act(() => {
      result.current.change('patientName', 'Asha R');
    });
    rerender({ params: paramsWith({ patientName: 'Asha' }) });

    expect(result.current.text.patientName).toBe('Asha R');
    pause();
    expect(onChange).toHaveBeenLastCalledWith({ patientName: 'Asha R' });
  });

  it('drops a waiting search for a box the URL has overwritten since', () => {
    const { result, rerender, onChange, pause } = setup({ patientName: 'Zzy' });
    act(() => {
      result.current.change('patientName', 'Zzyx');
    });
    // The empty list's own "Clear filters" empties the URL before the pause ends.
    rerender({ params: paramsWith() });
    pause();

    expect(result.current.text.patientName).toBe('');
    expect(onChange).not.toHaveBeenCalled();
  });
});
