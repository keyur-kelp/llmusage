import { IstDatePipe, formatIst } from './ist-date.pipe';

describe('IstDatePipe', () => {
  it('formats midnight IST (18:30Z the day before) with an IST suffix', () => {
    expect(formatIst('2026-11-06T18:30:00.000Z')).toBe('07 Nov 2026, 00:00 IST');
  });

  it('formats a mid-day instant in +05:30', () => {
    expect(formatIst('2026-11-05T06:00:00Z')).toBe('05 Nov 2026, 11:30 IST');
  });

  it('returns empty text for empty or invalid input', () => {
    const pipe = new IstDatePipe();
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('nope')).toBe('');
  });
});
