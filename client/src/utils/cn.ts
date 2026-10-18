export type ClassValue = string | false | null | undefined;

/** Joins class names, skipping the falsy ones: `cn('a', isOn && 'b')`. */
export const cn = (...classes: ClassValue[]): string => classes.filter(Boolean).join(' ');
