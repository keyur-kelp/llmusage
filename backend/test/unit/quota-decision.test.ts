import Decimal from 'decimal.js';
import { buildQuotaPart, decideQuota } from '../../src/services/quota-service';
import { systemPeriod } from '../../src/lib/time';

const d = (s: string): Decimal => new Decimal(s);

describe('decideQuota', () => {
  it('allows below both', () => expect(decideQuota(d('1'), d('100'), d('1'), d('10'))).toBe('ALLOW'));
  it('blocks user at exactly the quota', () => expect(decideQuota(d('1'), d('100'), d('10'), d('10'))).toBe('USER'));
  it('blocks system at exactly the quota', () => expect(decideQuota(d('100'), d('100'), d('1'), d('10'))).toBe('SYSTEM'));
  it('system wins when both exceeded', () => expect(decideQuota(d('101'), d('100'), d('11'), d('10'))).toBe('SYSTEM'));
  it('allows when one cent below (overshoot rule is about the next message)', () =>
    expect(decideQuota(d('9.999999'), d('100'), d('9.999999'), d('10'))).toBe('ALLOW'));
  it('quota 0 blocks everyone', () => expect(decideQuota(d('0'), d('100'), d('0'), d('0'))).toBe('USER'));
});

describe('buildQuotaPart', () => {
  const period = systemPeriod(new Date('2026-11-05T06:00:00Z'), 1);
  it('computes remaining and pct', () => {
    const p = buildQuotaPart(d('10'), d('1.234567'), period);
    expect(p.remainingUsd).toBe('8.765433');
    expect(p.remainingPct).toBe('87.65');
    expect(p.resetsAtIst).toBe('2026-12-01T00:00:00.000+05:30');
  });
  it('never goes negative and 0% for zero quota', () => {
    expect(buildQuotaPart(d('1'), d('3'), period).remainingUsd).toBe('0.000000');
    expect(buildQuotaPart(d('0'), d('0'), period).remainingPct).toBe('0.00');
  });
});
