import { complementPct, formatIsoDay, quotaState, defaultIstRange, istToday, compareDecimal, formatPct, formatPctCapped, formatUsd, pctToBar, toIsoDate } from './format';

describe('format helpers', () => {
  it('keeps money as the exact server string', () => {
    expect(formatUsd('8.765433')).toBe('$8.765433');
    expect(formatUsd('0.000001')).toBe('$0.000001');
    expect(formatPct('87.65')).toBe('87.65%');
  });

  it('clamps progress bar values', () => {
    expect(pctToBar('87.65')).toBe(87.65);
    expect(pctToBar('-3')).toBe(0);
    expect(pctToBar('250')).toBe(100);
    expect(pctToBar('x')).toBe(0);
  });

  it('formats picked dates as local YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 10, 5))).toBe('2026-11-05');
    expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('compares decimal strings without floats', () => {
    expect(compareDecimal('10.000000', '9.999999')).toBeGreaterThan(0);
    expect(compareDecimal('0.000001', '0.000002')).toBeLessThan(0);
    expect(compareDecimal('1.5', '1.500000')).toBe(0);
    expect(compareDecimal('100', '99.999999')).toBeGreaterThan(0);
  });
});

describe('IST dates', () => {
  it('uses the IST date, not the UTC one, just after 18:30Z', () => {
    expect(istToday(new Date('2026-11-05T18:29:59Z'))).toBe('2026-11-05');
    expect(istToday(new Date('2026-11-05T18:30:00Z'))).toBe('2026-11-06');
  });

  it('default range runs from the 1st of the IST month to the IST today', () => {
    const r = defaultIstRange(new Date('2026-11-30T19:00:00Z')); // already 1 Dec in IST
    expect(toIsoDate(r.from)).toBe('2026-12-01');
    expect(toIsoDate(r.to)).toBe('2026-12-01');
  });
});

describe('quotaState', () => {
  it('is ok at 20% and above, low under 20%, used up at 0', () => {
    expect(quotaState('87.65')).toBe('ok');
    expect(quotaState('20.00')).toBe('ok');
    expect(quotaState('19.99')).toBe('low');
    expect(quotaState('0.01')).toBe('low');
    expect(quotaState('0.00')).toBe('used-up');
  });
});

describe('complementPct', () => {
  it('computes 100 - pct with integer maths', () => {
    expect(complementPct('97.23')).toBe('2.77');
    expect(complementPct('100.00')).toBe('0.00');
    expect(complementPct('0')).toBe('100.00');
    expect(complementPct('99.9')).toBe('0.10');
  });
});

describe('formatIsoDay', () => {
  it('formats YYYY-MM-DD as dd Mon yyyy', () => {
    expect(formatIsoDay('2026-11-05')).toBe('05 Nov 2026');
    expect(formatIsoDay('garbage')).toBe('garbage');
  });
});

describe('formatPctCapped', () => {
  it('passes normal values through and caps above 999', () => {
    expect(formatPctCapped('87.65')).toBe('87.65%');
    expect(formatPctCapped('999.00')).toBe('999.00%');
    expect(formatPctCapped('449400.00')).toBe('>999%');
  });
});
