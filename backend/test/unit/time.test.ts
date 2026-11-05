import { istDate, systemPeriod, toIstIso, userPeriod, yesterdayIst } from '../../src/lib/time';

const utc = (s: string): Date => new Date(s);

describe('istDate', () => {
  it('flips at 00:00 IST (18:30 UTC)', () => {
    expect(istDate(utc('2026-11-05T18:29:59Z'))).toBe('2026-11-05');
    expect(istDate(utc('2026-11-05T18:30:00Z'))).toBe('2026-11-06');
  });
});

describe('userPeriod', () => {
  // 2026-11-07 is a Saturday (ISO weekday 6)
  it('counts today when today is the reset weekday', () => {
    const p = userPeriod(utc('2026-11-07T06:00:00Z'), 6);
    expect(p.startDate).toBe('2026-11-07');
    expect(p.endDate).toBe('2026-11-14');
    expect(p.startUtc.toISOString()).toBe('2026-11-06T18:30:00.000Z');
    expect(p.endUtc.toISOString()).toBe('2026-11-13T18:30:00.000Z');
  });

  it('goes back to the most recent reset weekday', () => {
    const p = userPeriod(utc('2026-11-05T06:00:00Z'), 6); // Thursday
    expect(p.startDate).toBe('2026-10-31');
    expect(p.endDate).toBe('2026-11-07');
  });

  it.each([1, 2, 3, 4, 5, 6, 7])('start is always a day with weekday %i, within 7 days before now', (dow) => {
    // iterate every day of a week
    for (let i = 0; i < 7; i++) {
      const now = new Date(Date.UTC(2026, 10, 2 + i, 7, 0, 0)); // Mon 2 Nov .. Sun 8 Nov
      const p = userPeriod(now, dow);
      const startWeekday = new Date(`${p.startDate}T00:00:00Z`).getUTCDay() || 7;
      expect(startWeekday).toBe(dow);
      expect(p.startUtc.getTime()).toBeLessThanOrEqual(now.getTime());
      expect(p.endUtc.getTime() - p.startUtc.getTime()).toBe(7 * 86400_000);
      expect(p.endUtc.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it('switches period exactly at 00:00 IST', () => {
    // Friday 2026-11-06 18:29:59Z is still Fri 23:59:59 IST -> previous Saturday 2026-10-31
    expect(userPeriod(utc('2026-11-06T18:29:59Z'), 6).startDate).toBe('2026-10-31');
    // 18:30:00Z is Sat 00:00 IST -> new period
    expect(userPeriod(utc('2026-11-06T18:30:00Z'), 6).startDate).toBe('2026-11-07');
  });

  it('handles year boundary', () => {
    const p = userPeriod(utc('2027-01-01T06:00:00Z'), 6); // Friday
    expect(p.startDate).toBe('2026-12-26');
    expect(p.endDate).toBe('2027-01-02');
  });
});

describe('systemPeriod', () => {
  it('uses this month when today >= reset day', () => {
    const p = systemPeriod(utc('2026-11-05T06:00:00Z'), 5);
    expect(p.startDate).toBe('2026-11-05');
    expect(p.endDate).toBe('2026-12-05');
  });

  it('uses previous month when today < reset day', () => {
    const p = systemPeriod(utc('2026-11-05T06:00:00Z'), 6);
    expect(p.startDate).toBe('2026-10-06');
    expect(p.endDate).toBe('2026-11-06');
  });

  it('dom 1 default', () => {
    const p = systemPeriod(utc('2026-11-05T06:00:00Z'), 1);
    expect(p.startDate).toBe('2026-11-01');
    expect(p.endDate).toBe('2026-12-01');
  });

  it('Dec -> Jan rollover', () => {
    const p = systemPeriod(utc('2026-12-20T06:00:00Z'), 15);
    expect(p.startDate).toBe('2026-12-15');
    expect(p.endDate).toBe('2027-01-15');
  });

  it('Jan before reset day goes back to December', () => {
    const p = systemPeriod(utc('2027-01-03T06:00:00Z'), 15);
    expect(p.startDate).toBe('2026-12-15');
    expect(p.endDate).toBe('2027-01-15');
  });

  it('February with dom 28', () => {
    const p = systemPeriod(utc('2027-02-28T06:00:00Z'), 28);
    expect(p.startDate).toBe('2027-02-28');
    expect(p.endDate).toBe('2027-03-28');
    const q = systemPeriod(utc('2027-03-01T06:00:00Z'), 28);
    expect(q.startDate).toBe('2027-02-28');
  });

  it('switches exactly at 00:00 IST on the reset day', () => {
    // 2026-11-30 18:29:59Z = 2026-11-30 23:59:59 IST
    expect(systemPeriod(utc('2026-11-30T18:29:59Z'), 1).startDate).toBe('2026-11-01');
    expect(systemPeriod(utc('2026-11-30T18:30:00Z'), 1).startDate).toBe('2026-12-01');
  });

  it('start/end UTC instants are 18:30Z the day before', () => {
    const p = systemPeriod(utc('2026-11-05T06:00:00Z'), 1);
    expect(p.startUtc.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(p.endUtc.toISOString()).toBe('2026-11-30T18:30:00.000Z');
  });
});

describe('helpers', () => {
  it('toIstIso uses +05:30', () => {
    expect(toIstIso(utc('2026-11-06T18:30:00Z'))).toBe('2026-11-07T00:00:00.000+05:30');
  });
  it('yesterdayIst', () => {
    expect(yesterdayIst(utc('2026-11-05T20:00:00Z'))).toBe('2026-11-05'); // already 6 Nov in IST
    expect(yesterdayIst(utc('2026-11-05T10:00:00Z'))).toBe('2026-11-04');
  });
});
