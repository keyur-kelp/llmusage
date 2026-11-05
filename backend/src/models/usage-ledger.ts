import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class UsageLedger extends Model<InferAttributes<UsageLedger>, InferCreationAttributes<UsageLedger>> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare conversationId: string;
  declare assistantMessageId: string;
  declare model: string;
  declare inputTokens: number;
  declare outputTokens: number;
  declare costUsd: string;
  declare litellmCostRaw: string;
  declare litellmCallId: string | null;
  declare usageDate: string;
  declare createdAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    UsageLedger.init(
      {
        id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
        userId: { type: DataTypes.UUID, allowNull: false },
        conversationId: { type: DataTypes.UUID, allowNull: false },
        assistantMessageId: { type: DataTypes.UUID, allowNull: false },
        model: { type: DataTypes.STRING(200), allowNull: false },
        inputTokens: { type: DataTypes.INTEGER, allowNull: false },
        outputTokens: { type: DataTypes.INTEGER, allowNull: false },
        costUsd: { type: DataTypes.DECIMAL(14, 6), allowNull: false },
        litellmCostRaw: { type: DataTypes.STRING(64), allowNull: false },
        litellmCallId: { type: DataTypes.STRING(100), allowNull: true },
        usageDate: { type: DataTypes.DATEONLY, allowNull: false },
        createdAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'usage_ledger', updatedAt: false },
    );
  }
}
