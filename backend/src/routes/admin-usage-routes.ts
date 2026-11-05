import { Router } from 'express';
import { z } from 'zod';
import {
  UsageReportService,
  ledgerQuerySchema,
  rangeQuerySchema,
} from '../services/usage-report-service';
import { RollupService } from '../services/rollup-service';
import { getQuery, validateBody, validateQuery } from '../middleware/validate';
import { isValidIsoDate } from '../lib/time';

const rollupBody = z.object({
  date: z.string().refine(isValidIsoDate, 'Must be a valid YYYY-MM-DD date').optional(),
});

export function adminUsageRoutes(report: UsageReportService, rollup: RollupService): Router {
  const r = Router();
  r.get('/usage/summary', async (_req, res) => {
    res.json(await report.summary());
  });
  r.get('/usage/daily', validateQuery(rangeQuerySchema), async (_req, res) => {
    const q = getQuery<z.infer<typeof rangeQuerySchema>>(res);
    res.json(await report.daily(q.from, q.to, q.userId));
  });
  r.get('/usage/ledger', validateQuery(ledgerQuerySchema), async (_req, res) => {
    const q = getQuery<z.infer<typeof ledgerQuerySchema>>(res);
    res.json(await report.ledger(q.from, q.to, q.userId, q.limit));
  });
  r.post('/rollup/run', validateBody(rollupBody), async (req, res) => {
    const { date } = req.body as z.infer<typeof rollupBody>;
    res.json(await rollup.rollUpDay(date ?? rollup.yesterday()));
  });
  return r;
}
