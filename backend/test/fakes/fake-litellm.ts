import http, { IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';

export interface RecordedChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream: boolean | undefined;
  streamOptions: unknown;
}

export interface FakeBehavior {
  models: string[];
  /** Cost reported in the final usage chunk. `undefined` omits the field (simulates misconfig). */
  cost: number | string | undefined;
  chunks: string[];
  promptTokens: number;
  completionTokens: number;
  /** When set, chat calls fail with this HTTP status. */
  failStatus: number | null;
  /** When true, send the first chunk then drop the connection (no usage). */
  dropMidStream: boolean;
  /** Delay between chunks (ms). */
  chunkDelayMs: number;
}

const defaults = (): FakeBehavior => ({
  models: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'],
  cost: 0.000123,
  chunks: ['Hello', ' world'],
  promptTokens: 10,
  completionTokens: 5,
  failStatus: null,
  dropMidStream: false,
  chunkDelayMs: 0,
});

/** Tiny OpenAI-compatible server emulating LiteLLM (streaming Path A, cost in the final chunk). */
export class FakeLiteLlm {
  behavior: FakeBehavior = defaults();
  requests: RecordedChatRequest[] = [];
  private server: http.Server;
  private counter = 0;

  constructor() {
    this.server = http.createServer((req, res) => {
      void this.handle(req, res);
    });
  }

  reset(): void {
    this.counter = 0;
    this.behavior = defaults();
    this.requests = [];
  }

  async start(): Promise<string> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  stop(): Promise<void> {
    this.server.closeAllConnections();
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method === 'GET' && req.url === '/v1/models') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ object: 'list', data: this.behavior.models.map((id) => ({ id, object: 'model' })) }));
      return;
    }
    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
      const body = JSON.parse(await readBody(req)) as {
        model: string;
        messages: { role: string; content: string }[];
        stream?: boolean;
        stream_options?: unknown;
      };
      this.requests.push({
        model: body.model,
        messages: body.messages,
        stream: body.stream,
        streamOptions: body.stream_options,
      });
      await this.chat(body.model, res);
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  }

  private async chat(model: string, res: ServerResponse): Promise<void> {
    const b = this.behavior;
    if (b.failStatus) {
      res.statusCode = b.failStatus;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'upstream failure', type: 'server_error' } }));
      return;
    }
    this.counter += 1;
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      'x-litellm-call-id': `fake-call-${this.counter}`,
    });
    const send = (obj: unknown): void => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    };
    const base = { id: `chatcmpl-${this.counter}`, object: 'chat.completion.chunk', created: 0, model };
    for (const [i, text] of b.chunks.entries()) {
      send({ ...base, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] });
      if (b.dropMidStream && i === 0) {
        res.destroy();
        return;
      }
      if (b.chunkDelayMs) await sleep(b.chunkDelayMs);
    }
    send({ ...base, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
    const usage: Record<string, unknown> = {
      prompt_tokens: b.promptTokens,
      completion_tokens: b.completionTokens,
      total_tokens: b.promptTokens + b.completionTokens,
    };
    if (b.cost !== undefined) usage['cost'] = b.cost;
    send({ ...base, choices: [], usage });
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c: Buffer) => (data += c.toString()));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
