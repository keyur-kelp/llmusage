import Decimal from 'decimal.js';
import { clampZero, parseMoney, pct, toMoneyString, MONEY_PATTERN } from '../../src/lib/money';

describe('money', () => {
  it('formats to 6 dp HALF_UP', () => {
    expect(toMoneyString(new Decimal('0.0000005'))).toBe('0.000001');
    expect(toMoneyString(new Decimal('0.0000004'))).toBe('0.000000');
    expect(toMoneyString(new Decimal('10'))).toBe('10.000000');
  });
  it('has no float drift', () => {
    expect(toMoneyString(parseMoney('0.1').plus(parseMoney('0.2')))).toBe('0.300000');
  });
  it('parses numbers via their string form', () => {
    expect(toMoneyString(parseMoney(0.000123))).toBe('0.000123');
    expect(toMoneyString(parseMoney(1e-7))).toBe('0.000000');
  });
  it('clampZero', () => {
    expect(clampZero(new Decimal('-1')).toString()).toBe('0');
    expect(clampZero(new Decimal('2')).toString()).toBe('2');
  });
  it('pct', () => {
    expect(pct(new Decimal('8.765433'), new Decimal('10'))).toBe('87.65');
    expect(pct(new Decimal('1'), new Decimal('0'))).toBe('0.00');
  });
  it('money pattern rejects negatives, exponents and too many places', () => {
    for (const bad of ['-1', '1e3', '1.1234567', '', 'abc', '.5', '123456789']) {
      expect(MONEY_PATTERN.test(bad)).toBe(false);
    }
    for (const good of ['0', '10', '0.000001', '99999999.999999']) {
      expect(MONEY_PATTERN.test(good)).toBe(true);
    }
  });
});
