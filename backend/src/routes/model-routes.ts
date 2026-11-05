import { Router } from 'express';
import { AppError } from '../lib/errors';
import { LlmGateway } from '../services/llm-gateway';

/** The preferred model if LiteLLM lists it, else the first listed model (LiteLLM's order is not guaranteed). */
export function pickDefaultModel(ids: string[], preferred?: string): string | null {
  if (preferred && ids.includes(preferred)) return preferred;
  return ids[0] ?? null;
}

export function modelRoutes(gateway: LlmGateway, defaultModel?: string): Router {
  const r = Router();
  r.get('/', async (_req, res) => {
    try {
      const ids = await gateway.listModels();
      res.json({ models: ids.map((id) => ({ id })), defaultModel: pickDefaultModel(ids, defaultModel) });
    } catch {
      throw new AppError('LLM_UNAVAILABLE', 502, 'The language model service is unavailable');
    }
  });
  return r;
}
