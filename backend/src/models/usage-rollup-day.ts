import { DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class UsageRollupDay extends Model<InferAttributes<UsageRollupDay>, InferCreationAttributes<UsageRollupDay>> {
  declare usageDate: string;
  declare rolledAt: Date;

  static initModel(sequelize: Sequelize): void {
    UsageRollupDay.init(
      {
        usageDate: { type: DataTypes.DATEONLY, primaryKey: true },
        rolledAt: { type: DataTypes.DATE, allowNull: false },
      },
      { sequelize, tableName: 'usage_rollup_days', timestamps: false },
    );
  }
}
