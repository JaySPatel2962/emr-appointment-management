import { MOBILE_PATTERN } from '@/constants/patient';

// The API's mobile number rules (server/src/utils/mobile.ts), so the form can say what is wrong
// before submitting. The server applies them again and stays the authority.

const SEPARATORS = /[\s\-().]/g;
// A +91, 91 or 0 prefix, stripped only when a complete 10-digit mobile number follows.
const COUNTRY_OR_TRUNK_PREFIX = /^(\+91|91|0)(?=[6-9]\d{9}$)/;

/** "+91 98765-43210" -> "9876543210" */
export const normalizeMobile = (value: string): string =>
  value.trim().replace(SEPARATORS, '').replace(COUNTRY_OR_TRUNK_PREFIX, '');

export const isValidMobile = (value: string): boolean =>
  MOBILE_PATTERN.test(normalizeMobile(value));

/** "9876543210" -> "98765 43210", the way Indian numbers are usually read out. */
export const formatMobile = (mobile: string): string =>
  /^\d{10}$/.test(mobile) ? `${mobile.slice(0, 5)} ${mobile.slice(5)}` : mobile;
