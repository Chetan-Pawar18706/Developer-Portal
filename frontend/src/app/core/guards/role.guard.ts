import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { Role } from '../models/user.model';
import { AuthService } from '../services/auth.service';

export function roleGuard(roles: readonly Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.role();

    if (role === null) {
      return router.createUrlTree(['/auth/login']);
    }

    if (roles.includes(role)) {
      return true;
    }

    return router.createUrlTree(['/dashboard']);
  };
}
