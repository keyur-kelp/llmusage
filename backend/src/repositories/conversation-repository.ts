import { Transaction } from 'sequelize';
import { Conversation } from '../models';

export class ConversationRepository {
  create(userId: string, title: string, transaction: Transaction): Promise<Conversation> {
    return Conversation.create({ userId, title }, { transaction });
  }

  /** Returns the conversation only if it belongs to `userId`. */
  findOwned(id: string, userId: string): Promise<Conversation | null> {
    return Conversation.findOne({ where: { id, userId } });
  }

  listByUser(userId: string): Promise<Conversation[]> {
    return Conversation.findAll({ where: { userId }, order: [['updatedAt', 'DESC']] });
  }

  async touch(id: string, transaction: Transaction): Promise<void> {
    await Conversation.update({ updatedAt: new Date() }, { where: { id }, transaction, silent: true });
  }
}
