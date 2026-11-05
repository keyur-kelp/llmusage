import { Router } from 'express';
import { ChatInput, ChatService, chatBodySchema } from '../services/chat-service';
import { validateBody } from '../middleware/validate';
import { currentUser } from '../middleware/authenticate';

export function chatRoutes(chat: ChatService): Router {
  const r = Router();
  r.post('/stream', validateBody(chatBodySchema), async (req, res) => {
    // Throws (-> JSON error via the error handler) before any SSE header is written.
    const prepared = await chat.prepare(currentUser(res).id, req.body as ChatInput);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let closed = false;
    res.on('close', () => {
      closed = true;
    });

    // The upstream call is never aborted on disconnect: we keep consuming so spend is recorded.
    await chat.execute(prepared, (event, data) => {
      if (closed || res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    });
    if (!closed && !res.writableEnded) res.end();
  });
  return r;
}
