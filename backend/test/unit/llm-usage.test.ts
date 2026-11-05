import { LlmError, parseUsage } from '../../src/services/llm-gateway';

describe('parseUsage (cost extraction)', () => {
  it('converts a JSON number cost to a 6 dp string and keeps the raw text', () => {
    const r = parseUsage({ prompt_tokens: 12, completion_tokens: 34, cost: 0.0001234567 }, 'call-1');
    expect(r).toEqual({ inputTokens: 12, outputTokens: 34, costUsd: '0.000123', costRaw: '0.0001234567', callId: 'call-1' });
  });
  it('rounds HALF_UP at the 7th decimal', () => {
    expect(parseUsage({ prompt_tokens: 1, completion_tokens: 1, cost: 0.0000005 }, null).costUsd).toBe('0.000001');
  });
  it('rounds a float artifact (5.999999999999999e-6) to 0.000006 and keeps the raw value', () => {
    const r = parseUsage({ prompt_tokens: 1, completion_tokens: 1, cost: 5.999999999999999e-6 }, null);
    expect(r.costUsd).toBe('0.000006');
    expect(r.costRaw).toBe('0.000005999999999999999');
  });
  it('handles exponent-form costs (4e-8 -> 0.000000) and keeps the raw value', () => {
    const r = parseUsage({ prompt_tokens: 1, completion_tokens: 1, cost: 4e-8 }, null);
    expect(r.costUsd).toBe('0.000000');
    expect(r.costRaw).toBe('4e-8');
  });
  it('accepts a string cost and zero', () => {
    expect(parseUsage({ prompt_tokens: 1, completion_tokens: 1, cost: '0.5' }, null).costUsd).toBe('0.500000');
    expect(parseUsage({ prompt_tokens: 1, completion_tokens: 1, cost: 0 }, null).costUsd).toBe('0.000000');
  });
  it('throws when cost is missing (no fallback pricing)', () => {
    expect(() => parseUsage({ prompt_tokens: 1, completion_tokens: 1 }, null)).toThrow(LlmError);
    expect(() => parseUsage({ prompt_tokens: 1, completion_tokens: 1, cost: null }, null)).toThrow(LlmError);
  });
  it('throws when usage is missing or malformed', () => {
    expect(() => parseUsage(null, null)).toThrow(LlmError);
    expect(() => parseUsage({ prompt_tokens: 'x' }, null)).toThrow(LlmError);
  });
  it('rejects negative or non-numeric cost', () => {
    expect(() => parseUsage({ prompt_tokens: 1, completion_tokens: 1, cost: -1 }, null)).toThrow(LlmError);
    expect(() => parseUsage({ prompt_tokens: 1, completion_tokens: 1, cost: 'abc' }, null)).toThrow(LlmError);
  });
});
