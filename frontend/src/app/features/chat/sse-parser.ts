export interface SseEvent {
  event: string;
  data: string;
}

/**
 * Incremental Server-Sent Events parser. Feed it decoded text chunks of any size;
 * it returns the complete events found so far and buffers the rest.
 * Works the same whether one or many `delta` events arrive.
 */
export class SseParser {
  private buffer = '';

  feed(chunk: string): SseEvent[] {
    this.buffer = (this.buffer + chunk).replace(/\r\n/g, '\n');
    const events: SseEvent[] = [];
    let idx = this.buffer.indexOf('\n\n');
    while (idx !== -1) {
      const block = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      const ev = parseBlock(block);
      if (ev) events.push(ev);
      idx = this.buffer.indexOf('\n\n');
    }
    return events;
  }
}

function parseBlock(block: string): SseEvent | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  if (data.length === 0) return null;
  return { event, data: data.join('\n') };
}
