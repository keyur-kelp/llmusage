import { Router } from 'express';
import { QuotaService } from '../services/quota-service';
import { currentUser } from '../middleware/authenticate';

export function quotaRoutes(quota: QuotaService): Router {
  const r = Router();
  r.get('/me', async (_req, res) => {
    res.json(await quota.getStatus(currentUser(res).id));
  });
  return r;
}
