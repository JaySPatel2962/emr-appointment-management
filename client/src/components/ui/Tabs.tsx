import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface TabItem<V extends string> {
  value: V;
  label: string;
}

export interface TabsProps<V extends string> {
  /** Names the tab list for screen readers. */
  label: string;
  items: readonly TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  /** The selected tab's content. */
  children: ReactNode;
}

/**
 * Tabs in the WAI-ARIA pattern: one tab stop for the list, arrows (and Home/End) move between
 * tabs and select them, and Tab moves on into the panel.
 */
export const Tabs = <V extends string>({
  label,
  items,
  value,
  onChange,
  children,
}: TabsProps<V>) => {
  const baseId = useId();
  const tabs = useRef(new Map<V, HTMLButtonElement>());
  const tabId = (tab: V) => `${baseId}-tab-${tab}`;
  const panelId = `${baseId}-panel`;

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = items.length - 1;
    let target: number;
    switch (event.key) {
      case 'ArrowRight':
        target = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        target = index === 0 ? last : index - 1;
        break;
      case 'Home':
        target = 0;
        break;
      case 'End':
        target = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    const item = items[target];
    if (item) {
      onChange(item.value);
      tabs.current.get(item.value)?.focus();
    }
  };

  return (
    <div>
      {/* The bottom line is an inset shadow, not a border the tabs overlap with a negative
          margin: that 1px of overflow made the scrolling list show a vertical scrollbar on
          systems with classic scrollbars, such as Windows. */}
      <div
        role="tablist"
        aria-label={label}
        className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-line)]"
      >
        {items.map((item, index) => {
          const selected = item.value === value;
          return (
            <button
              key={item.value}
              ref={(node) => {
                if (node) {
                  tabs.current.set(item.value, node);
                } else {
                  tabs.current.delete(item.value);
                }
              }}
              type="button"
              role="tab"
              id={tabId(item.value)}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.value)}
              onKeyDown={(event) => handleKey(event, index)}
              className={cn(
                'border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                selected
                  ? 'border-carbon text-carbon'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {/* Every panel holds a form, so Tab reaches its first field; the panel needs no tab stop. */}
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(value)} className="pt-6">
        {children}
      </div>
    </div>
  );
};
