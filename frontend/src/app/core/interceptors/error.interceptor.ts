import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { getErrorMessage } from '../../shared/utils/http-error';

const SILENT_ENDPOINTS = ['/auth/refresh', '/auth/logout'];

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snackBar = inject(MatSnackBar);
  const silent = SILENT_ENDPOINTS.some((endpoint) => req.url.includes(endpoint));

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!silent) {
        snackBar.open(getErrorMessage(error), 'Dismiss', {
          duration: 5000,
          horizontalPosition: 'right',
          verticalPosition: 'bottom',
          panelClass: 'app-snackbar-error',
        });
      }

      return throwError(() => error);
    }),
  );
};
