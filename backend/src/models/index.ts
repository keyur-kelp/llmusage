import { Sequelize } from 'sequelize';
import { User } from './user';
import { Setting } from './setting';
import { Conversation } from './conversation';
import { Message } from './message';
import { UsageLedger } from './usage-ledger';
import { UsageDailyRollup } from './usage-daily-rollup';
import { UsageRollupDay } from './usage-rollup-day';

export { User, Setting, Conversation, Message, UsageLedger, UsageDailyRollup, UsageRollupDay };

/** Initialises every model on the given Sequelize instance (idempotent). Never calls sync(). */
export function initModels(sequelize: Sequelize): void {
  User.initModel(sequelize);
  Setting.initModel(sequelize);
  Conversation.initModel(sequelize);
  Message.initModel(sequelize);
  UsageLedger.initModel(sequelize);
  UsageDailyRollup.initModel(sequelize);
  UsageRollupDay.initModel(sequelize);

  Conversation.hasMany(Message, { foreignKey: 'conversationId' });
  Message.belongsTo(Conversation, { foreignKey: 'conversationId' });
  User.hasMany(Conversation, { foreignKey: 'userId' });
  Conversation.belongsTo(User, { foreignKey: 'userId' });
}
export type { UserRole } from './user';
export type { MessageRole } from './message';
