import { Router } from 'express';
import { z } from 'zod';
import { currentUser } from '../middleware/authenticate';
import { notFound } from '../lib/errors';
import { ConversationService } from '../services/conversation-service';

const idSchema = z.string().uuid();

export function conversationRoutes(conversations: ConversationService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json({ conversations: await conversations.list(currentUser(res).id) });
  });
  r.get('/:id', async (req, res) => {
    const id = idSchema.safeParse(req.params['id']);
    if (!id.success) throw notFound('Conversation not found');
    res.json(await conversations.getOwned(id.data, currentUser(res).id));
  });
  return r;
}
