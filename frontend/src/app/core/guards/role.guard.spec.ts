import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  UrlTree,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import type { Role } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

const route = {} as ActivatedRouteSnapshot;
const state = { url: '/admin/users' } as RouterStateSnapshot;

function runGuard(role: Role | null): boolean | UrlTree {
  const roleSignal = signal<Role | null>(role);

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { role: roleSignal } },
    ],
  });

  return TestBed.runInInjectionContext(() => roleGuard(['admin'])(route, state)) as
    | boolean
    | UrlTree;
}

describe('roleGuard', () => {
  it('allows a user whose role is permitted', () => {
    expect(runGuard('admin')).toBe(true);
  });

  it('redirects a user whose role is not permitted', () => {
    const result = runGuard('client');

    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toBe('/dashboard');
  });

  it('redirects an unauthenticated visitor to login', () => {
    const result = runGuard(null);

    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toBe('/auth/login');
  });
});
