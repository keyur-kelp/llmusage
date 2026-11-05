import { Transaction, UniqueConstraintError } from 'sequelize';
import { User, UserRole } from '../models';

export interface NewUser {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
}

export interface UserPatch {
  name?: string;
  role?: UserRole;
  isActive?: boolean;
  quotaOverrideUsd?: string | null;
  passwordHash?: string;
  tokenVersionIncrement?: boolean;
}

export class EmailTakenError extends Error {}

export class UserRepository {
  findById(id: string, transaction?: Transaction): Promise<User | null> {
    return User.findByPk(id, { transaction });
  }

  findByEmail(email: string): Promise<User | null> {
    return User.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  listAll(): Promise<User[]> {
    return User.findAll({ order: [['createdAt', 'ASC']] });
  }

  async create(input: NewUser): Promise<User> {
    try {
      return await User.create({ ...input, email: input.email.trim().toLowerCase() });
    } catch (err) {
      if (err instanceof UniqueConstraintError) throw new EmailTakenError();
      throw err;
    }
  }

  /** Creates the user if the (lower-cased) email is new. Returns whether it was created. */
  async createIfMissing(input: NewUser): Promise<{ user: User; created: boolean }> {
    const [user, created] = await User.findOrCreate({
      where: { email: input.email.trim().toLowerCase() },
      defaults: { ...input, email: input.email.trim().toLowerCase() },
    });
    return { user, created };
  }

  async update(id: string, patch: UserPatch): Promise<User | null> {
    const user = await User.findByPk(id);
    if (!user) return null;
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.isActive !== undefined) user.isActive = patch.isActive;
    if (patch.quotaOverrideUsd !== undefined) user.quotaOverrideUsd = patch.quotaOverrideUsd;
    if (patch.passwordHash !== undefined) user.passwordHash = patch.passwordHash;
    if (patch.tokenVersionIncrement) user.tokenVersion = user.tokenVersion + 1;
    await user.save();
    return user;
  }
}
