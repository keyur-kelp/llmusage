import { Sequelize } from 'sequelize';
import { UserRepository } from './user-repository';
import { SettingsRepository } from './settings-repository';
import { ConversationRepository } from './conversation-repository';
import { MessageRepository } from './message-repository';
import { UsageRepository } from './usage-repository';
import { RollupRepository } from './rollup-repository';

export interface Repositories {
  users: UserRepository;
  settings: SettingsRepository;
  conversations: ConversationRepository;
  messages: MessageRepository;
  usage: UsageRepository;
  rollup: RollupRepository;
}

export function createRepositories(sequelize: Sequelize): Repositories {
  return {
    users: new UserRepository(),
    settings: new SettingsRepository(),
    conversations: new ConversationRepository(),
    messages: new MessageRepository(),
    usage: new UsageRepository(sequelize),
    rollup: new RollupRepository(sequelize),
  };
}
