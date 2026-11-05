import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiError } from './api-error';
import { DailyUsage, Role, Settings, UsageSummary, UserDto } from './models';

export interface CreateUserBody {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface UpdateUserBody {
  name?: string;
  role?: Role;
  isActive?: boolean;
  quotaOverrideUsd?: string | null;
}

/** Thin wrapper over the /api/admin endpoints. Errors are normalised to ApiError. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  private async call<T>(p: Promise<T>): Promise<T> {
    try {
      return await p;
    } catch (err) {
      throw ApiError.fromHttp(err);
    }
  }

  getSettings(): Promise<Settings> {
    return this.call(firstValueFrom(this.http.get<Settings>('/api/admin/settings')));
  }

  putSettings(s: Settings): Promise<Settings> {
    return this.call(
      firstValueFrom(
        this.http.put<Settings>('/api/admin/settings', {
          systemQuotaUsd: s.systemQuotaUsd,
          defaultUserQuotaUsd: s.defaultUserQuotaUsd,
          userResetDow: s.userResetDow,
          systemResetDom: s.systemResetDom,
        }),
      ),
    );
  }

  summary(): Promise<UsageSummary> {
    return this.call(firstValueFrom(this.http.get<UsageSummary>('/api/admin/usage/summary')));
  }

  daily(from: string, to: string, userId?: string): Promise<DailyUsage> {
    let params = new HttpParams().set('from', from).set('to', to);
    if (userId) params = params.set('userId', userId);
    return this.call(firstValueFrom(this.http.get<DailyUsage>('/api/admin/usage/daily', { params })));
  }

  async listUsers(): Promise<UserDto[]> {
    const res = await this.call(firstValueFrom(this.http.get<{ users: UserDto[] }>('/api/admin/users')));
    return res.users;
  }

  createUser(body: CreateUserBody): Promise<UserDto> {
    return this.call(firstValueFrom(this.http.post<UserDto>('/api/admin/users', body)));
  }

  updateUser(id: string, body: UpdateUserBody): Promise<UserDto> {
    return this.call(firstValueFrom(this.http.patch<UserDto>('/api/admin/users/' + id, body)));
  }

  async resetPassword(id: string, password: string): Promise<void> {
    await this.call(firstValueFrom(this.http.post<void>('/api/admin/users/' + id + '/password', { password })));
  }
}

/** Human-readable text for an API error, including validation issues when present. */
export function describeError(err: unknown): string {
  const e = ApiError.fromHttp(err);
  const issues = e.details?.['issues'];
  if (Array.isArray(issues) && issues.length > 0) {
    return issues
      .map((i: { path?: string; message?: string }) => (i.path ? i.path + ': ' : '') + (i.message ?? ''))
      .join('; ');
  }
  return e.message;
}
