import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class UsageDailyRollup extends Model<
  InferAttributes<UsageDailyRollup>,
  InferCreationAttributes<UsageDailyRollup>
> {
  declare usageDate: string;
  declare userId: string;
  declare model: string;
  declare inputTokens: string;
  declare outputTokens: string;
  declare costUsd: string;
  declare requestCount: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    UsageDailyRollup.init(
      {
        usageDate: { type: DataTypes.DATEONLY, primaryKey: true },
        userId: { type: DataTypes.UUID, primaryKey: true },
        model: { type: DataTypes.STRING(200), primaryKey: true },
        inputTokens: { type: DataTypes.BIGINT, allowNull: false },
        outputTokens: { type: DataTypes.BIGINT, allowNull: false },
        costUsd: { type: DataTypes.DECIMAL(14, 6), allowNull: false },
        requestCount: { type: DataTypes.INTEGER, allowNull: false },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'usage_daily_rollup' },
    );
  }
}
