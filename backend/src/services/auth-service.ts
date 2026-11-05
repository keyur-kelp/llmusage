import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { Repositories } from '../repositories';
import { User } from '../models';
import { AppError, unauthenticated } from '../lib/errors';
import { UserDto, toUserDto } from './user-dto';

const BCRYPT_COST = 12;
const TOKEN_TTL = '12h';
// Used to equalise timing when the email does not exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 4);

const tokenPayload = z.object({ sub: z.string().uuid(), tv: z.number().int() });

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, BCRYPT_COST);

export class AuthService {
  constructor(
    private readonly repos: Repositories,
    private readonly jwtSecret: string,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: UserDto }> {
    const user = await this.repos.users.findByEmail(email);
    const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new AppError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    if (!user.isActive) throw new AppError('ACCOUNT_DISABLED', 403, 'This account has been disabled');
    const token = jwt.sign({ tv: user.tokenVersion }, this.jwtSecret, {
      algorithm: 'HS256',
      subject: user.id,
      expiresIn: TOKEN_TTL,
    });
    return { token, user: toUserDto(user) };
  }

  /** Verifies the token AND reloads the user from the DB (active flag, token_version, role). */
  async authenticate(token: string): Promise<User> {
    let payload: z.infer<typeof tokenPayload>;
    try {
      const decoded = jwt.verify(token, this.jwtSecret, { algorithms: ['HS256'] });
      payload = tokenPayload.parse(decoded);
    } catch {
      throw unauthenticated('Invalid or expired token');
    }
    const user = await this.repos.users.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) throw unauthenticated('Invalid or expired token');
    if (!user.isActive) throw new AppError('ACCOUNT_DISABLED', 403, 'This account has been disabled');
    return user;
  }
}
