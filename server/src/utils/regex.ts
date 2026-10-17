/** Escapes text for use inside a RegExp, so user input always matches literally. */
export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
