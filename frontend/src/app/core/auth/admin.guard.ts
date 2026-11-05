import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from './auth.service';

/** UI convenience only: the server's 403 is the real control. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const snack = inject(MatSnackBar);
  const user = await auth.ensureUser();
  if (!user) return router.parseUrl('/login');
  if (user.role !== 'ADMIN') {
    snack.open('You are not authorised to open the admin screen.', 'Dismiss', { duration: 5000 });
    return router.parseUrl('/chat');
  }
  return true;
};
