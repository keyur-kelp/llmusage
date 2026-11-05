import { QueryInterface } from 'sequelize';

export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.query(`
    CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');

    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(320) NOT NULL,
      name varchar(200) NOT NULL,
      password_hash varchar(100) NOT NULL,
      role user_role NOT NULL DEFAULT 'USER',
      is_active boolean NOT NULL DEFAULT true,
      quota_override_usd numeric(14,6) NULL CHECK (quota_override_usd >= 0),
      token_version integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX users_email_unique ON users (email);

    CREATE TABLE settings (
      id smallint PRIMARY KEY CHECK (id = 1),
      system_quota_usd numeric(14,6) NOT NULL DEFAULT 100 CHECK (system_quota_usd >= 0),
      default_user_quota_usd numeric(14,6) NOT NULL DEFAULT 10 CHECK (default_user_quota_usd >= 0),
      user_reset_dow smallint NOT NULL DEFAULT 6 CHECK (user_reset_dow BETWEEN 1 AND 7),
      system_reset_dom smallint NOT NULL DEFAULT 1 CHECK (system_reset_dom BETWEEN 1 AND 28),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO settings (id) VALUES (1);
  `);
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.sequelize.query(`
    DROP TABLE IF EXISTS settings;
    DROP TABLE IF EXISTS users;
    DROP TYPE IF EXISTS user_role;
  `);
}
