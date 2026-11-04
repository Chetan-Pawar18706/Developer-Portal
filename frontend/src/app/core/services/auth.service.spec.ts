import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { AuthResponse, User } from '../models/user.model';
import { AuthService } from './auth.service';

const testUser: User = {
  id: '507f1f77bcf86cd799439011',
  name: 'Jane Client',
  email: 'jane@example.com',
  role: 'client',
  avatar: null,
  isActive: true,
  notificationPrefs: {
    emailOnAssignment: true,
    emailOnMention: true,
    emailOnStatusChange: true,
    emailOnReminder: true,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const authResponse: AuthResponse = {
  user: testUser,
  accessToken: 'access-token',
};

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('project-platform.has-session', '1');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('keeps the access token in memory after login', () => {
    let result: AuthResponse | undefined;

    service.login({ email: 'jane@example.com', password: 'Password123!' }).subscribe((response) => {
      result = response;
    });

    const request = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'jane@example.com',
      password: 'Password123!',
    });

    request.flush({ success: true, data: authResponse, message: 'Login successful' });

    expect(result?.accessToken).toBe('access-token');
    expect(service.accessToken()).toBe('access-token');
    expect(service.currentUser()).toEqual(testUser);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.role()).toBe('client');
  });

  it('clears the token and user after logout', () => {
    service.login({ email: 'jane@example.com', password: 'Password123!' }).subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ success: true, data: authResponse, message: 'Login successful' });

    service.logout().subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/logout`)
      .flush({ success: true, data: null, message: 'Logged out successfully' });

    expect(service.accessToken()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
    expect(service.role()).toBeNull();
  });

  it('clears the session when logout fails', () => {
    service.login({ email: 'jane@example.com', password: 'Password123!' }).subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({ success: true, data: authResponse, message: 'Login successful' });

    service.logout().subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/auth/logout`)
      .flush('network', { status: 500, statusText: 'Server Error' });

    expect(service.isLoggedIn()).toBe(false);
  });

  it('restores the session from the refresh cookie', async () => {
    const restore = service.restoreSession();

    const request = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(request.request.method).toBe('POST');
    request.flush({ success: true, data: authResponse, message: 'Session refreshed' });

    await restore;

    expect(service.isLoggedIn()).toBe(true);
    expect(service.accessToken()).toBe('access-token');
  });

  it('does not request a refresh when there is no session hint', async () => {
    localStorage.removeItem('project-platform.has-session');

    await service.restoreSession();

    httpMock.expectNone(`${environment.apiUrl}/auth/refresh`);
    expect(service.isLoggedIn()).toBe(false);
  });

  it('stays signed out when the refresh cookie is invalid', async () => {
    const restore = service.restoreSession();

    httpMock
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush(
        { success: false, data: null, message: 'Invalid refresh token' },
        { status: 401, statusText: 'Unauthorized' },
      );

    await restore;

    expect(service.isLoggedIn()).toBe(false);
    expect(service.accessToken()).toBeNull();
  });
});
