import { Routes, UrlMatcher, UrlSegment } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

/** Matches `/chat` and `/chat/:id` (id exposed as a route param). */
export const chatMatcher: UrlMatcher = (segments: UrlSegment[]) => {
  const first = segments[0];
  if (!first || first.path !== 'chat' || segments.length > 2) return null;
  const id = segments[1];
  return id ? { consumed: segments, posParams: { id } } : { consumed: segments };
};

export const routes: Routes = [
  { path: 'login', title: 'Sign in · LLM Usage Control', loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage) },
  // One route for /chat and /chat/:id so the page (and the focused composer) survives the first message of a new chat.
  { matcher: chatMatcher, title: 'Chat · LLM Usage Control', canActivate: [authGuard], loadComponent: () => import('./features/chat/chat.page').then((m) => m.ChatPage) },
  { path: 'admin', title: 'Admin · Usage · LLM Usage Control', canActivate: [adminGuard], loadComponent: () => import('./features/admin/admin.page').then((m) => m.AdminPage) },
  { path: '', pathMatch: 'full', redirectTo: 'chat' },
  { path: '**', redirectTo: 'chat' },
];
