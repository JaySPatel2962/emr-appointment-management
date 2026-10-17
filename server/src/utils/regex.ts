/** Escapes text for use inside a RegExp, so user input always matches literally. */
export const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches values that start with `text`. Anchored, so MongoDB can answer it from an index. */
export const prefixRegex = (text: string): RegExp => new RegExp(`^${escapeRegex(text)}`);

/** Case-insensitive "contains". Can't use an index, so only for small collections. */
export const containsRegex = (text: string): RegExp => new RegExp(escapeRegex(text), 'i');
