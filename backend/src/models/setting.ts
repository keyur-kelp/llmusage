import { DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export class Setting extends Model<InferAttributes<Setting>, InferCreationAttributes<Setting>> {
  declare id: number;
  declare systemQuotaUsd: string;
  declare defaultUserQuotaUsd: string;
  declare userResetDow: number;
  declare systemResetDom: number;
  declare updatedAt: Date;

  static initModel(sequelize: Sequelize): void {
    Setting.init(
      {
        id: { type: DataTypes.SMALLINT, primaryKey: true },
        systemQuotaUsd: { type: DataTypes.DECIMAL(14, 6), allowNull: false },
        defaultUserQuotaUsd: { type: DataTypes.DECIMAL(14, 6), allowNull: false },
        userResetDow: { type: DataTypes.SMALLINT, allowNull: false },
        systemResetDom: { type: DataTypes.SMALLINT, allowNull: false },
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'settings', createdAt: false },
    );
  }
}
