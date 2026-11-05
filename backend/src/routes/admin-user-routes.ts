import { Router } from 'express';
import { z } from 'zod';
import {
  UserService,
  createUserSchema,
  passwordSchema,
  updateUserSchema,
} from '../services/user-service';
import { validateBody, uuidParamOf } from '../middleware/validate';
import { currentUser } from '../middleware/authenticate';

export function adminUserRoutes(users: UserService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json({ users: await users.list() });
  });
  r.post('/', validateBody(createUserSchema), async (req, res) => {
    res.status(201).json(await users.create(req.body as z.infer<typeof createUserSchema>));
  });
  r.patch('/:id', validateBody(updateUserSchema), async (req, res) => {
    const id = uuidParamOf(req.params['id']);
    res.json(await users.update(currentUser(res).id, id, req.body as z.infer<typeof updateUserSchema>));
  });
  r.post('/:id/password', validateBody(passwordSchema), async (req, res) => {
    const id = uuidParamOf(req.params['id']);
    await users.resetPassword(id, (req.body as z.infer<typeof passwordSchema>).password);
    res.status(204).end();
  });
  return r;
}
