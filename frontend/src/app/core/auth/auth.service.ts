import { Injectable, Injector, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LoginResponse, UserDto } from '../api/models';
import { ApiError } from '../api/api-error';
import { ChatStore } from '../../features/chat/chat.store';

export const TOKEN_KEY = 'llmusage.token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  // Resolved lazily: ChatStore -> ChatStreamService -> AuthService would otherwise be circular.
  private readonly injector = inject(Injector);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly user = signal<UserDto | null>(null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  async login(email: string, password: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.post<LoginResponse>('/api/auth/login', { email, password }));
      localStorage.setItem(TOKEN_KEY, res.token);
      this.token.set(res.token);
      this.user.set(res.user);
    } catch (err) {
      throw ApiError.fromHttp(err);
    }
  }

  /** Loads the current user using the stored token; returns null (and clears the session) if it is not valid. */
  async ensureUser(): Promise<UserDto | null> {
    if (!this.token()) return null;
    const cached = this.user();
    if (cached) return cached;
    try {
      const me = await firstValueFrom(this.http.get<UserDto>('/api/auth/me'));
      this.user.set(me);
      return me;
    } catch {
      this.clear();
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.token.set(null);
    this.user.set(null);
    this.injector.get(ChatStore).reset();
  }

  logout(): void {
    this.clear();
    void this.router.navigateByUrl('/login');
  }
}
