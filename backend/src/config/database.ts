import { Sequelize } from 'sequelize';

/** Single place where the Sequelize instance is built. Schema changes are migrations only (never sync()). */
export function createSequelize(databaseUrl: string, logging: false | ((sql: string) => void) = false): Sequelize {
  return new Sequelize(databaseUrl, {
    dialect: 'postgres',
    logging,
    define: { underscored: true },
    pool: { max: 10, min: 0, idle: 10000 },
  });
}
