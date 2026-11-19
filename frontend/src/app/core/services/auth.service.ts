import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/api.model';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Role,
  UpdateProfileRequest,
  User,
} from '../models/user.model';

const SESSION_HINT_KEY = 'project-platform.has-session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  private readonly accessTokenSignal = signal<string | null>(null);
  private readonly currentUserSignal = signal<User | null>(null);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.currentUserSignal() !== null);
  readonly role = computed<Role | null>(() => this.currentUserSignal()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isStaff = computed(() => {
    const role = this.role();
    return role === 'admin' || role === 'pm' || role === 'developer';
  });

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.baseUrl}/login`, credentials).pipe(
      tap((response) => this.setSession(response.data)),
      map((response) => response.data),
    );
  }

  register(input: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.baseUrl}/register`, input).pipe(
      tap((response) => this.setSession(response.data)),
      map((response) => response.data),
    );
  }

  refresh(): Observable<AuthResponse> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.baseUrl}/refresh`, {}).pipe(
      tap((response) => this.setSession(response.data)),
      map((response) => response.data),
    );
  }

  loadMe(): Observable<User> {
    return this.http.get<ApiResponse<{ user: User }>>(`${this.baseUrl}/me`).pipe(
      tap((response) => this.currentUserSignal.set(response.data.user)),
      map((response) => response.data.user),
    );
  }

  setCurrentUser(user: User): void {
    this.currentUserSignal.set(user);
  }

  updateProfile(input: UpdateProfileRequest): Observable<User> {
    return this.http
      .patch<ApiResponse<{ user: User }>>(`${this.baseUrl}/profile`, input)
      .pipe(
        tap((response) => this.currentUserSignal.set(response.data.user)),
        map((response) => response.data.user),
      );
  }

  logout(): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${this.baseUrl}/logout`, {}).pipe(
      tap(() => this.clearSession()),
      map(() => undefined),
      catchError(() => {
        this.clearSession();
        return of(undefined);
      }),
    );
  }

  forgotPassword(email: string): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/forgot-password`, { email })
      .pipe(map(() => undefined));
  }

  resetPassword(token: string, password: string): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/reset-password`, { token, password })
      .pipe(map(() => undefined));
  }

  /**
   * Restores the session from the httpOnly refresh cookie. Runs during app
   * initialization, before the router evaluates any guards.
   */
  async restoreSession(): Promise<void> {
    if (this.currentUserSignal() !== null || !this.hasSessionHint()) {
      return;
    }

    try {
      await firstValueFrom(this.refresh());
    } catch {
      this.clearSession();
    }
  }

  clearSession(): void {
    this.accessTokenSignal.set(null);
    this.currentUserSignal.set(null);
    this.clearSessionHint();
  }

  private setSession(response: AuthResponse): void {
    this.accessTokenSignal.set(response.accessToken);
    this.currentUserSignal.set(response.user);
    this.setSessionHint();
  }

  private hasSessionHint(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(SESSION_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }

  private setSessionHint(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SESSION_HINT_KEY, '1');
      }
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
  }

  private clearSessionHint(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SESSION_HINT_KEY);
      }
    } catch {
      // Storage can be unavailable in private or restricted browsing contexts.
    }
  }
}
