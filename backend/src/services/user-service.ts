import { z } from 'zod';
import { Repositories } from '../repositories';
import { EmailTakenError } from '../repositories/user-repository';
import { AppError, notFound } from '../lib/errors';
import { MONEY_PATTERN } from '../lib/money';
import { hashPassword } from './auth-service';
import { UserDto, toUserDto } from './user-dto';

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
  role: z.enum(['USER', 'ADMIN']),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    role: z.enum(['USER', 'ADMIN']),
    isActive: z.boolean(),
    quotaOverrideUsd: z.string().regex(MONEY_PATTERN).nullable(),
  })
  .partial();

export const passwordSchema = z.object({ password: z.string().min(8).max(200) });

export class UserService {
  constructor(private readonly repos: Repositories) {}

  async list(): Promise<UserDto[]> {
    return (await this.repos.users.listAll()).map(toUserDto);
  }

  async create(input: z.infer<typeof createUserSchema>): Promise<UserDto> {
    if (await this.repos.users.findByEmail(input.email)) throw emailTaken();
    try {
      const user = await this.repos.users.create({
        name: input.name,
        email: input.email,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      });
      return toUserDto(user);
    } catch (err) {
      if (err instanceof EmailTakenError) throw emailTaken();
      throw err;
    }
  }

  async update(actorId: string, id: string, patch: z.infer<typeof updateUserSchema>): Promise<UserDto> {
    if (actorId === id && (patch.isActive === false || patch.role === 'USER')) {
      throw new AppError('SELF_LOCKOUT', 409, 'You cannot deactivate yourself or remove your own admin role');
    }
    const user = await this.repos.users.update(id, {
      ...patch,
      tokenVersionIncrement: patch.isActive === false,
    });
    if (!user) throw notFound('User not found');
    return toUserDto(user);
  }

  async resetPassword(id: string, password: string): Promise<void> {
    const user = await this.repos.users.update(id, {
      passwordHash: await hashPassword(password),
      tokenVersionIncrement: true,
    });
    if (!user) throw notFound('User not found');
  }
}

const emailTaken = (): AppError => new AppError('EMAIL_TAKEN', 409, 'A user with this email already exists');
