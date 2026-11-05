import { QueryInterface } from 'sequelize';

export async function up(qi: QueryInterface): Promise<void> {
  await qi.sequelize.query(`
    CREATE TYPE message_role AS ENUM ('user', 'assistant');

    CREATE TABLE conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users (id),
      title varchar(120) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX conversations_user_updated_idx ON conversations (user_id, updated_at DESC);

    CREATE TABLE messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
      role message_role NOT NULL,
      content text NOT NULL,
      model varchar(200) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX messages_conversation_created_idx ON messages (conversation_id, created_at);
  `);
}

export async function down(qi: QueryInterface): Promise<void> {
  await qi.sequelize.query(`
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS conversations;
    DROP TYPE IF EXISTS message_role;
  `);
}
