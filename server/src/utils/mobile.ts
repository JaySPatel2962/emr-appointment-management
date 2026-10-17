import { MOBILE_PATTERN } from '#app/constants/patient.js';

const SEPARATORS = /[\s\-().]/g;
// A +91, 91 or 0 prefix, stripped only when what follows is a complete 10-digit mobile number.
const COUNTRY_OR_TRUNK_PREFIX = /^(\+91|91|0)(?=[6-9]\d{9}$)/;

/**
 * Reduces an Indian mobile number to its 10 digits: "+91 98765-43210" -> "9876543210".
 * Input that doesn't fit is returned without separators, so validation can reject it and a
 * partial search such as "98765" still works as a prefix.
 */
export const normalizeMobile = (value: string): string =>
  value.replace(SEPARATORS, '').replace(COUNTRY_OR_TRUNK_PREFIX, '');

export const isValidMobile = (value: string): boolean => MOBILE_PATTERN.test(value);

/**
 * Turns (part of) a typed mobile number into a prefix of the stored 10 digits. A "+91" is
 * dropped even from partial input, since nothing stored starts with "+".
 */
export const mobileSearchPrefix = (value: string): string =>
  normalizeMobile(value).replace(/^\+91/, '');
