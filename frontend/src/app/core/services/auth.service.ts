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
  User,
} from '../models/user.model';

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
    return role === 'admin' || role === 'pm';
  });

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.baseUrl}/login`, credentials)
      .pipe(
        tap((response) => this.setSession(response.data)),
        map((response) => response.data),
      );
  }

  register(input: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.baseUrl}/register`, input)
      .pipe(
        tap((response) => this.setSession(response.data)),
        map((response) => response.data),
      );
  }

  refresh(): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.baseUrl}/refresh`, {})
      .pipe(
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
    if (this.currentUserSignal() !== null) {
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
  }

  private setSession(response: AuthResponse): void {
    this.accessTokenSignal.set(response.accessToken);
    this.currentUserSignal.set(response.user);
  }
}
