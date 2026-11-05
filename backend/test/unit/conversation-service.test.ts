import { ConversationService } from '../../src/services/conversation-service';
import { Repositories } from '../../src/repositories';

function make(owned: boolean): ConversationService {
  const conv = { id: 'c1', title: 'T', updatedAt: new Date('2026-11-05T00:00:00Z') };
  const msg = { id: 'm1', role: 'user', content: 'hi', model: 'x', createdAt: new Date('2026-11-05T00:00:01Z') };
  const repos = {
    conversations: { listByUser: async () => [conv], findOwned: async () => (owned ? conv : null) },
    messages: { listByConversation: async () => [msg] },
  } as unknown as Repositories;
  return new ConversationService(repos);
}

describe('ConversationService', () => {
  it('lists DTOs with ISO timestamps', async () => {
    expect(await make(true).list('u')).toEqual([{ id: 'c1', title: 'T', updatedAt: '2026-11-05T00:00:00.000Z' }]);
  });
  it('returns the detail with messages for the owner', async () => {
    const d = await make(true).getOwned('c1', 'u');
    expect(d.messages).toEqual([{ id: 'm1', role: 'user', content: 'hi', model: 'x', createdAt: '2026-11-05T00:00:01.000Z' }]);
  });
  it('throws NOT_FOUND for non-owners', async () => {
    await expect(make(false).getOwned('c1', 'u')).rejects.toMatchObject({ code: 'NOT_FOUND', httpStatus: 404 });
  });
});
