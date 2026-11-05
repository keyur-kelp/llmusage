import { QueryInterface } from 'sequelize';

export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.query(`
    CREATE TABLE usage_ledger (
      id bigserial PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users (id),
      conversation_id uuid NOT NULL REFERENCES conversations (id),
      assistant_message_id uuid NOT NULL UNIQUE REFERENCES messages (id),
      model varchar(200) NOT NULL,
      input_tokens integer NOT NULL CHECK (input_tokens >= 0),
      output_tokens integer NOT NULL CHECK (output_tokens >= 0),
      cost_usd numeric(14,6) NOT NULL CHECK (cost_usd >= 0),
      litellm_cost_raw varchar(64) NOT NULL,
      litellm_call_id varchar(100) NULL,
      usage_date date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX usage_ledger_date_user_idx ON usage_ledger (usage_date, user_id);
    CREATE INDEX usage_ledger_user_date_idx ON usage_ledger (user_id, usage_date);

    CREATE TABLE usage_daily_rollup (
      usage_date date NOT NULL,
      user_id uuid NOT NULL REFERENCES users (id),
      model varchar(200) NOT NULL,
      input_tokens bigint NOT NULL DEFAULT 0,
      output_tokens bigint NOT NULL DEFAULT 0,
      cost_usd numeric(14,6) NOT NULL DEFAULT 0,
      request_count integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (usage_date, user_id, model)
    );
    CREATE INDEX usage_daily_rollup_user_date_idx ON usage_daily_rollup (user_id, usage_date);

    CREATE TABLE usage_rollup_days (
      usage_date date PRIMARY KEY,
      rolled_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.sequelize.query(`
    DROP TABLE IF EXISTS usage_rollup_days;
    DROP TABLE IF EXISTS usage_daily_rollup;
    DROP TABLE IF EXISTS usage_ledger;
  `);
}
