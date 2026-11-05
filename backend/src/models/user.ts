import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, Sequelize } from 'sequelize';

export type UserRole = 'USER' | 'ADMIN';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare email: string;
  declare name: string;
  declare passwordHash: string;
  declare role: CreationOptional<UserRole>;
  declare isActive: CreationOptional<boolean>;
  declare quotaOverrideUsd: CreationOptional<string | null>;
  declare tokenVersion: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  static initModel(sequelize: Sequelize): void {
    User.init(
      {
        id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        email: { type: DataTypes.STRING(320), allowNull: false },
        name: { type: DataTypes.STRING(200), allowNull: false },
        passwordHash: { type: DataTypes.STRING(100), allowNull: false },
        role: { type: DataTypes.ENUM('USER', 'ADMIN'), allowNull: false, defaultValue: 'USER' },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        quotaOverrideUsd: { type: DataTypes.DECIMAL(14, 6), allowNull: true },
        tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'users' },
    );
  }
}
