import { Pipe, PipeTransform } from '@angular/core';

const FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Formats an ISO instant as e.g. "07 Nov 2026, 00:00 IST" (Asia/Kolkata, +05:30). */
export function formatIst(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${FORMATTER.format(d)} IST`;
}

@Pipe({ name: 'istDate' })
export class IstDatePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatIst(value);
  }
}

const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
const DAY = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short' });
const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });

/** True when the instant falls on the same IST calendar day as `now`. */
export function isIstToday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && IST_DAY.format(d) === IST_DAY.format(now);
}

/** "Today 17:31" for today (IST), otherwise "05 Nov". */
export function formatIstShort(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return isIstToday(iso, now) ? `Today ${TIME.format(d)}` : DAY.format(d);
}
