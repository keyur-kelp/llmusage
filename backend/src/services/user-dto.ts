import { User } from '../models';
import { parseMoney, toMoneyString } from '../lib/money';

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  isActive: boolean;
  quotaOverrideUsd: string | null;
}

/** Never includes the password hash. */
export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    quotaOverrideUsd: u.quotaOverrideUsd === null ? null : toMoneyString(parseMoney(u.quotaOverrideUsd)),
  };
}
