import { Repositories } from '../repositories';
import { notFound } from '../lib/errors';

export interface ConversationSummaryDto {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ConversationDetailDto {
  id: string;
  title: string;
  messages: { id: string; role: 'user' | 'assistant'; content: string; model: string; createdAt: string }[];
}

export class ConversationService {
  constructor(private readonly repos: Repositories) {}

  async list(userId: string): Promise<ConversationSummaryDto[]> {
    const list = await this.repos.conversations.listByUser(userId);
    return list.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }));
  }

  /** Owner only, admins included (AC-10): anything else is a 404. */
  async getOwned(id: string, userId: string): Promise<ConversationDetailDto> {
    const conv = await this.repos.conversations.findOwned(id, userId);
    if (!conv) throw notFound('Conversation not found');
    const messages = await this.repos.messages.listByConversation(conv.id);
    return {
      id: conv.id,
      title: conv.title,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        model: m.model,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }
}
