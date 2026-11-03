import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  shareReplay,
  switchMap,
  throwError,
} from 'rxjs';
import type { AuthResponse } from '../models/user.model';
import { AuthService } from '../services/auth.service';

const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

let refreshInFlight$: Observable<AuthResponse> | null = null;

function isAuthEndpoint(url: string): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.accessToken();
  const authRequest = isAuthEndpoint(req.url);

  const request = token
    ? req.clone({
        withCredentials: true,
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req.clone({ withCredentials: true });

  return next(request).pipe(
    catchError((error: unknown) => {
      if (authRequest || !(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      if (!refreshInFlight$) {
        refreshInFlight$ = auth.refresh().pipe(
          catchError((refreshError: unknown) => {
            auth.clearSession();

            if (!router.url.startsWith('/auth/')) {
              void router.navigate(['/auth/login']);
            }

            return throwError(() => refreshError);
          }),
          finalize(() => {
            refreshInFlight$ = null;
          }),
          shareReplay({ bufferSize: 1, refCount: false }),
        );
      }

      return refreshInFlight$.pipe(
        switchMap(() => {
          const refreshedToken = auth.accessToken();
          const retriedRequest = refreshedToken
            ? req.clone({
                withCredentials: true,
                setHeaders: { Authorization: `Bearer ${refreshedToken}` },
              })
            : req.clone({ withCredentials: true });

          return next(retriedRequest);
        }),
      );
    }),
  );
};
