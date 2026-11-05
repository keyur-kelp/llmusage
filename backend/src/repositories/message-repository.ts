import { Transaction } from 'sequelize';
import { Message, MessageRole } from '../models';

export interface NewMessage {
  conversationId: string;
  role: MessageRole;
  content: string;
  model: string;
  createdAt: Date;
}

export class MessageRepository {
  listByConversation(conversationId: string): Promise<Message[]> {
    return Message.findAll({ where: { conversationId }, order: [['createdAt', 'ASC'], ['role', 'ASC']] });
  }

  create(input: NewMessage, transaction: Transaction): Promise<Message> {
    return Message.create(input, { transaction });
  }
}
