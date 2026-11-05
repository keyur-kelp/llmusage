import type { Logger } from 'pino';
import { Repositories } from '../repositories';
import { hashPassword } from './auth-service';

/** AC-1: create the admin from env on first start; never overwrite an existing user. */
export async function bootstrapAdmin(
  repos: Repositories,
  logger: Logger,
  email: string | undefined,
  password: string | undefined,
): Promise<void> {
  if (!email || !password) {
    logger.info('ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin bootstrap');
    return;
  }
  const existing = await repos.users.findByEmail(email);
  if (existing) {
    logger.info({ email: existing.email }, 'admin exists');
    return;
  }
  const { created, user } = await repos.users.createIfMissing({
    email,
    name: 'Administrator',
    passwordHash: await hashPassword(password),
    role: 'ADMIN',
  });
  logger.info({ email: user.email }, created ? 'admin created' : 'admin exists');
}
