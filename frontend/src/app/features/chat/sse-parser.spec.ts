import { SseParser } from './sse-parser';

describe('SseParser', () => {
  it('parses a single complete event', () => {
    const p = new SseParser();
    expect(p.feed('event: delta\ndata: {"text":"Hi"}\n\n')).toEqual([{ event: 'delta', data: '{"text":"Hi"}' }]);
  });

  it('parses many events in one chunk, in order', () => {
    const p = new SseParser();
    const out = p.feed('event: delta\ndata: 1\n\nevent: delta\ndata: 2\n\nevent: done\ndata: 3\n\n');
    expect(out.map((e) => e.event + ':' + e.data)).toEqual(['delta:1', 'delta:2', 'done:3']);
  });

  it('buffers events split across chunks at arbitrary positions', () => {
    const p = new SseParser();
    const text = 'event: delta\ndata: {"text":"Hello"}\n\nevent: done\ndata: {}\n\n';
    const events = [];
    for (const ch of text) events.push(...p.feed(ch));
    expect(events.length).toBe(2);
    expect(events[0].data).toBe('{"text":"Hello"}');
  });

  it('handles CRLF line endings, including a CRLF split across chunks', () => {
    const p = new SseParser();
    expect(p.feed('event: delta\r\ndata: a\r')).toEqual([]);
    expect(p.feed('\n\r\n')).toEqual([{ event: 'delta', data: 'a' }]);
  });

  it('joins multi-line data and ignores comments and unknown fields', () => {
    const p = new SseParser();
    expect(p.feed(': keepalive\nid: 7\ndata: a\ndata: b\n\n')).toEqual([{ event: 'message', data: 'a\nb' }]);
  });

  it('ignores blocks without data and keeps an incomplete tail buffered', () => {
    const p = new SseParser();
    expect(p.feed('event: x\n\nevent: delta\ndata: part')).toEqual([]);
    expect(p.feed('ial\n\n')).toEqual([{ event: 'delta', data: 'partial' }]);
  });

  it('works unchanged for the single-delta shape (one delta then done)', () => {
    const p = new SseParser();
    const out = p.feed('event: delta\ndata: {"text":"whole answer"}\n\nevent: done\ndata: {}\n\n');
    expect(out.map((e) => e.event)).toEqual(['delta', 'done']);
  });
});
