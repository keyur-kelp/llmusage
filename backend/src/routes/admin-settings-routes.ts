import { Router } from 'express';
import { z } from 'zod';
import { SettingsService, settingsSchema } from '../services/settings-service';
import { validateBody } from '../middleware/validate';

export function adminSettingsRoutes(settings: SettingsService): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    res.json(await settings.get());
  });
  r.put('/', validateBody(settingsSchema), async (req, res) => {
    res.json(await settings.update(req.body as z.infer<typeof settingsSchema>));
  });
  return r;
}
