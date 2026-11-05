import { UrlSegment } from '@angular/router';
import { chatMatcher } from './app.routes';

const segs = (...p: string[]): UrlSegment[] => p.map((x) => new UrlSegment(x, {}));

describe('chatMatcher', () => {
  it('matches /chat with no id', () => {
    expect(chatMatcher(segs('chat'), null as never, null as never)?.posParams).toBeUndefined();
  });
  it('matches /chat/:id and exposes the id', () => {
    expect(chatMatcher(segs('chat', 'abc'), null as never, null as never)?.posParams?.['id']?.path).toBe('abc');
  });
  it('rejects other paths and extra segments', () => {
    expect(chatMatcher(segs('admin'), null as never, null as never)).toBeNull();
    expect(chatMatcher(segs('chat', 'a', 'b'), null as never, null as never)).toBeNull();
  });
});
