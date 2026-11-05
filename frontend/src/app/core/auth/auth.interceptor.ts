import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiErrorBody } from '../api/api-error';

/** Attaches the bearer token; on 401, or 403 ACCOUNT_DISABLED, clears the session and goes to /login. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const snack = inject(MatSnackBar);
  const token = auth.token();
  const isLogin = req.url.endsWith('/api/auth/login');
  const authed = token && !isLogin ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && !isLogin) {
        const code = (err.error as ApiErrorBody | null)?.error?.code;
        if (err.status === 401 || (err.status === 403 && code === 'ACCOUNT_DISABLED')) {
          auth.clear();
          if (code === 'ACCOUNT_DISABLED') {
            snack.open('Your account has been disabled.', 'Dismiss', { duration: 6000 });
          }
          void router.navigateByUrl('/login');
        }
      }
      return throwError(() => err);
    }),
  );
};
