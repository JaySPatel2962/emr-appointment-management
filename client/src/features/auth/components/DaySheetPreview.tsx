import { cn } from '@/utils/cn';

type PreviewTone = 'completed' | 'arrived' | 'booked' | 'open';

const ROWS: readonly { time: string; label: string; tone: PreviewTone }[] = [
  { time: '09:00', label: 'Completed', tone: 'completed' },
  { time: '09:15', label: 'Arrived', tone: 'arrived' },
  { time: '09:30', label: 'Booked', tone: 'booked' },
  { time: '09:45', label: 'Open', tone: 'open' },
];

const AFTER_BREAK: readonly { time: string; label: string; tone: PreviewTone }[] = [
  { time: '13:00', label: 'Booked', tone: 'booked' },
  { time: '13:15', label: 'Open', tone: 'open' },
];

const TONES: Readonly<Record<PreviewTone, string>> = {
  completed: 'bg-leaf-soft text-leaf',
  arrived: 'bg-saffron-soft text-saffron',
  booked: 'bg-carbon-soft text-carbon',
  open: 'border border-leaf/40 bg-paper text-leaf',
};

const Row = ({ time, label, tone }: { time: string; label: string; tone: PreviewTone }) => (
  <li className="flex items-center justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
    <span className="text-lg font-semibold text-ink tabular-nums">{time}</span>
    <span className={cn('rounded-md px-2 py-0.5 text-xs font-semibold', TONES[tone])}>{label}</span>
  </li>
);

/** The login page's picture of what the app is for: one doctor's day sheet. Decorative only. */
export const DaySheetPreview = () => (
  <aside className="hidden flex-col justify-center gap-12 bg-carbon px-12 py-14 text-white lg:flex xl:px-20">
    <div className="max-w-lg">
      <p className="text-3xl leading-tight font-bold tracking-tight text-balance xl:text-4xl">
        Every doctor's day, slot by slot.
      </p>
      <p className="mt-4 text-base text-white/85">
        Book visits, check patients in and see every change the moment it happens, at the front desk
        and in the consulting room.
      </p>
    </div>
    <div aria-hidden="true" className="w-full max-w-sm rounded-xl bg-paper p-5 text-ink">
      <p className="text-sm font-semibold text-ink-muted">Monday, 19 October</p>
      <ul className="mt-2">
        {ROWS.map((row) => (
          <Row key={row.time} {...row} />
        ))}
      </ul>
      <p className="my-2 rounded-md bg-hatch px-3 py-2 text-xs font-semibold text-slate">
        Lunch break, 12:00 to 13:00
      </p>
      <ul>
        {AFTER_BREAK.map((row) => (
          <Row key={row.time} {...row} />
        ))}
      </ul>
    </div>
  </aside>
);
