import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';
import { ChatStore } from '../../features/chat/chat.store';
import { UserDto } from '../api/models';

@Component({ template: '' })
class Dummy {}

const user = (role: 'USER' | 'ADMIN'): UserDto => ({ id: '1', email: 'a@b.c', name: 'A', role, isActive: true, quotaOverrideUsd: null });

describe('route guards', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let snack: jasmine.SpyObj<MatSnackBar>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['ensureUser']);
    snack = jasmine.createSpyObj<MatSnackBar>('MatSnackBar', ['open']);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', component: Dummy }, { path: 'chat', component: Dummy }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: MatSnackBar, useValue: snack },
      ],
    });
  });

  const run = async (guard: typeof authGuard): Promise<boolean | UrlTree> =>
    TestBed.runInInjectionContext(() => guard({} as never, {} as never)) as Promise<boolean | UrlTree>;

  it('authGuard allows a signed-in user', async () => {
    auth.ensureUser.and.resolveTo(user('USER'));
    expect(await run(authGuard)).toBeTrue();
  });

  it('authGuard redirects to /login when there is no valid session', async () => {
    auth.ensureUser.and.resolveTo(null);
    const r = await run(authGuard);
    expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/login');
  });

  it('adminGuard allows an ADMIN', async () => {
    auth.ensureUser.and.resolveTo(user('ADMIN'));
    expect(await run(adminGuard)).toBeTrue();
  });

  it('adminGuard sends a USER to /chat with a not-authorised snackbar', async () => {
    auth.ensureUser.and.resolveTo(user('USER'));
    const r = await run(adminGuard);
    expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/chat');
    expect(snack.open).toHaveBeenCalled();
    expect(snack.open.calls.mostRecent().args[0]).toContain('not authorised');
  });

  it('adminGuard sends an anonymous visitor to /login', async () => {
    auth.ensureUser.and.resolveTo(null);
    const r = await run(adminGuard);
    expect(TestBed.inject(Router).serializeUrl(r as UrlTree)).toBe('/login');
  });
});

describe('AuthService.clear', () => {
  it('resets the chat store so the next user sees no previous state', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    const chat = TestBed.inject(ChatStore);
    chat.activeId.set('abc');
    chat.messages.set([{ id: '1', role: 'user', content: 'x', model: 'm', createdAt: '' }]);
    TestBed.inject(AuthService).clear();
    expect(chat.activeId()).toBeNull();
    expect(chat.messages()).toEqual([]);
  });
});
