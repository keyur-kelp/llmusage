import express from 'express';
import request from 'supertest';
import { modelRoutes, pickDefaultModel } from '../../src/routes/model-routes';
import { LlmGateway } from '../../src/services/llm-gateway';

const ids = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];

function appWith(models: string[], defaultModel?: string): express.Express {
  const gateway = { listModels: async () => models } as unknown as LlmGateway;
  const app = express();
  app.use('/api/models', modelRoutes(gateway, defaultModel));
  return app;
}

describe('pickDefaultModel', () => {
  it('uses the preferred model when listed, else the first, else null', () => {
    expect(pickDefaultModel(ids, 'claude-opus-5-5')).toBe('claude-opus-5-5');
    expect(pickDefaultModel(ids, 'gone')).toBe('claude-haiku-5-5');
    expect(pickDefaultModel(ids)).toBe('claude-haiku-5-5');
    expect(pickDefaultModel([], 'x')).toBeNull();
  });
});

describe('GET /api/models', () => {
  it('returns defaultModel from DEFAULT_MODEL regardless of list order', async () => {
    const res = await request(appWith(ids, 'claude-sonnet-5-5')).get('/api/models');
    expect(res.status).toBe(200);
    expect(res.body.models).toEqual(ids.map((id) => ({ id })));
    expect(res.body.defaultModel).toBe('claude-sonnet-5-5');
  });
  it('falls back to the first listed model when DEFAULT_MODEL is absent or unlisted', async () => {
    expect((await request(appWith(ids)).get('/api/models')).body.defaultModel).toBe('claude-haiku-5-5');
    expect((await request(appWith(ids, 'nope')).get('/api/models')).body.defaultModel).toBe('claude-haiku-5-5');
  });
});
