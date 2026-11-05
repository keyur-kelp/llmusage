// Money stays a decimal string end to end. These helpers only add presentation.

/** "8.765433" -> "$8.765433". */
export function formatUsd(value: string): string {
  return '$' + value;
}

/** "87.65" -> "87.65%". */
export function formatPct(value: string): string {
  return value + '%';
}

/** Like formatPct but anything above 999 shows as ">999%" so a wildly over-quota row stays readable. */
export function formatPctCapped(value: string): string {
  return compareDecimal(value, '999') > 0 ? '>999%' : formatPct(value);
}

/** Progress bar value 0..100 for a percentage string (display only, not money). */
export function pctToBar(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Local Date -> YYYY-MM-DD using the date's own calendar fields (as picked in the date picker). */
export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

/** Today's calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function istToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Default daily-usage range: first of the IST month through today's IST date, as local-midnight Dates for the date picker. */
export function defaultIstRange(now: Date): { from: Date; to: Date } {
  const [y = 1970, m = 1, d = 1] = istToday(now).split('-').map((p) => parseInt(p, 10));
  return { from: new Date(y, m - 1, 1), to: new Date(y, m - 1, d) };
}

/** Compares two non-negative decimal strings without converting to floats. Returns <0, 0 or >0. */
export function compareDecimal(a: string, b: string): number {
  const [ai = '0', af = ''] = a.split('.');
  const [bi = '0', bf = ''] = b.split('.');
  const ni = ai.replace(/^0+(?=\d)/, '');
  const nj = bi.replace(/^0+(?=\d)/, '');
  if (ni.length !== nj.length) return ni.length - nj.length;
  if (ni !== nj) return ni < nj ? -1 : 1;
  const len = Math.max(af.length, bf.length);
  const fa = af.padEnd(len, '0');
  const fb = bf.padEnd(len, '0');
  return fa === fb ? 0 : fa < fb ? -1 : 1;
}

export type QuotaState = 'ok' | 'low' | 'used-up';

/** Threshold state from a "remaining %" string (decimal compare, no float maths): 0 -> used up, under 20 -> low. */
export function quotaState(remainingPct: string): QuotaState {
  if (compareDecimal(remainingPct, '0') <= 0) return 'used-up';
  if (compareDecimal(remainingPct, '20') < 0) return 'low';
  return 'ok';
}

/** 100 - pct for a non-negative percentage string, to 2 dp, using integer arithmetic ("97.23" -> "2.77"). */
export function complementPct(pct: string): string {
  const [i = '0', f = ''] = pct.split('.');
  const hundredths = BigInt(i || '0') * 100n + BigInt((f + '00').slice(0, 2));
  const rest = hundredths >= 10000n ? 0n : 10000n - hundredths;
  return (rest / 100n).toString() + '.' + (rest % 100n).toString().padStart(2, '0');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-05" -> "05 Nov 2026" (already an IST calendar date, so no timezone conversion). */
export function formatIsoDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return `${m[3]} ${MONTHS[parseInt(m[2] ?? '1', 10) - 1] ?? ''} ${m[1]}`;
}
