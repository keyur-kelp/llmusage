import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export type MessageRole = 'user' | 'assistant';

export class Message extends Model<InferAttributes<Message>, InferCreationAttributes<Message>> {
  declare id: CreationOptional<string>;
  declare conversationId: string;
  declare role: MessageRole;
  declare content: string;
  declare model: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    Message.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        conversationId: { type: DataTypes.UUID, allowNull: false },
        role: { type: DataTypes.ENUM('user', 'assistant'), allowNull: false },
        content: { type: DataTypes.TEXT, allowNull: false },
        model: { type: DataTypes.STRING(200), allowNull: false },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'messages' },
    );
  }
}
