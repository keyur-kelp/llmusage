import { DateTime } from 'luxon';

export const IST_ZONE = 'Asia/Kolkata';

export interface Period {
  startUtc: Date;
  endUtc: Date;
  /** IST calendar dates (YYYY-MM-DD), end exclusive. */
  startDate: string;
  endDate: string;
}

const DATE_FMT = 'yyyy-MM-dd';

function ist(instant: Date): DateTime {
  return DateTime.fromJSDate(instant, { zone: IST_ZONE });
}

function toPeriod(start: DateTime, end: DateTime): Period {
  return {
    startUtc: start.toUTC().toJSDate(),
    endUtc: end.toUTC().toJSDate(),
    startDate: start.toFormat(DATE_FMT),
    endDate: end.toFormat(DATE_FMT),
  };
}

/** IST calendar date (YYYY-MM-DD) of an instant. */
export function istDate(instant: Date): string {
  return ist(instant).toFormat(DATE_FMT);
}

/** Weekly user period starting at 00:00 IST on ISO weekday `resetDow` (1=Mon..7=Sun). */
export function userPeriod(now: Date, resetDow: number): Period {
  const today = ist(now).startOf('day');
  const back = (today.weekday - resetDow + 7) % 7;
  const start = today.minus({ days: back });
  return toPeriod(start, start.plus({ days: 7 }));
}

/** Monthly system period starting at 00:00 IST on day `resetDom` (1..28). */
export function systemPeriod(now: Date, resetDom: number): Period {
  const today = ist(now).startOf('day');
  const monthStart = today.startOf('month');
  const base = today.day >= resetDom ? monthStart : monthStart.minus({ months: 1 });
  const start = base.plus({ days: resetDom - 1 });
  const end = base.plus({ months: 1 }).plus({ days: resetDom - 1 });
  return toPeriod(start, end);
}

/** ISO string with +05:30 offset for the same instant. */
export function toIstIso(instant: Date): string {
  return ist(instant).toISO({ suppressMilliseconds: false }) ?? instant.toISOString();
}

/** Yesterday's IST date relative to `now`. */
export function yesterdayIst(now: Date): string {
  return ist(now).startOf('day').minus({ days: 1 }).toFormat(DATE_FMT);
}

export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromFormat(value, DATE_FMT, { zone: IST_ZONE }).isValid;
}

/** Whole days between two YYYY-MM-DD dates (to - from). */
export function daysBetween(from: string, to: string): number {
  const a = DateTime.fromFormat(from, DATE_FMT, { zone: IST_ZONE });
  const b = DateTime.fromFormat(to, DATE_FMT, { zone: IST_ZONE });
  return Math.round(b.diff(a, 'days').days);
}
