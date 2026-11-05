import Decimal from 'decimal.js';

// Money is always a decimal string or a Decimal. Never parseFloat / Number().
Decimal.set({ precision: 40 });

export const MONEY_PATTERN = /^\d{1,8}(\.\d{1,6})?$/;

export function parseMoney(value: string | number | Decimal): Decimal {
  return new Decimal(typeof value === 'number' ? String(value) : value);
}

/** Decimal -> string with exactly 6 dp, HALF_UP. */
export function toMoneyString(value: Decimal): string {
  return value.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6);
}

export function clampZero(value: Decimal): Decimal {
  return value.isNegative() ? new Decimal(0) : value;
}

/** part / whole * 100 as a 2 dp string; "0.00" when whole is 0. */
export function pct(part: Decimal, whole: Decimal): string {
  if (whole.isZero()) return '0.00';
  return part.div(whole).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}
