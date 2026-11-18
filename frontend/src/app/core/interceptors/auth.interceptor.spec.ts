import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import type { AuthResponse, User } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

const testUser: User = {
  id: '507f1f77bcf86cd799439011',
  name: 'Jane Client',
  email: 'jane@example.com',
  role: 'client',
  avatar: null,
  isActive: true,
  theme: 'light',
  notificationPrefs: {
    emailOnAssignment: true,
    emailOnMention: true,
    emailOnStatusChange: true,
    emailOnReminder: true,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

interface AuthStub {
  accessToken: ReturnType<typeof signal<string | null>>;
  refresh: ReturnType<typeof vi.fn>;
  clearSession: ReturnType<typeof vi.fn>;
}

function createAuthStub(refreshSource: Subject<AuthResponse>): AuthStub {
  return {
    accessToken: signal<string | null>('expired-token'),
    refresh: vi.fn(() => refreshSource.asObservable()),
    clearSession: vi.fn(),
  };
}

function configure(auth: AuthStub): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
    ],
  });
}

describe('authInterceptor', () => {
  it('refreshes once and retries the request with the new token', () => {
    const refreshSource = new Subject<AuthResponse>();
    const auth = createAuthStub(refreshSource);
    configure(auth);

    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);
    let received: unknown;

    http.get('/api/projects').subscribe((response) => {
      received = response;
    });

    const firstRequest = httpMock.expectOne('/api/projects');
    expect(firstRequest.request.headers.get('Authorization')).toBe('Bearer expired-token');
    expect(firstRequest.request.withCredentials).toBe(true);

    firstRequest.flush(
      { message: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(auth.refresh).toHaveBeenCalledTimes(1);

    auth.accessToken.set('fresh-token');
    refreshSource.next({ user: testUser, accessToken: 'fresh-token' });
    refreshSource.complete();

    const retriedRequest = httpMock.expectOne('/api/projects');
    expect(retriedRequest.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retriedRequest.flush({ items: [] });

    expect(received).toEqual({ items: [] });

    httpMock.verify();
  });

  it('queues concurrent 401 responses behind a single refresh', () => {
    const refreshSource = new Subject<AuthResponse>();
    const auth = createAuthStub(refreshSource);
    configure(auth);

    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    http.get('/api/projects').subscribe({ error: () => undefined });
    http.get('/api/tasks').subscribe({ error: () => undefined });

    const projectsRequest = httpMock.expectOne('/api/projects');
    const tasksRequest = httpMock.expectOne('/api/tasks');

    projectsRequest.flush(null, { status: 401, statusText: 'Unauthorized' });
    tasksRequest.flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.refresh).toHaveBeenCalledTimes(1);

    auth.accessToken.set('fresh-token');
    refreshSource.next({ user: testUser, accessToken: 'fresh-token' });
    refreshSource.complete();

    const projectsRetry = httpMock.expectOne('/api/projects');
    const tasksRetry = httpMock.expectOne('/api/tasks');

    expect(projectsRetry.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    expect(tasksRetry.request.headers.get('Authorization')).toBe('Bearer fresh-token');

    projectsRetry.flush({});
    tasksRetry.flush({});

    httpMock.verify();
  });

  it('clears the session and fails the request when refresh fails', () => {
    const refreshSource = new Subject<AuthResponse>();
    const auth = createAuthStub(refreshSource);
    configure(auth);

    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);
    let failed = false;

    http.get('/api/projects').subscribe({
      next: () => undefined,
      error: () => {
        failed = true;
      },
    });

    httpMock
      .expectOne('/api/projects')
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    refreshSource.error(new Error('refresh failed'));

    expect(auth.clearSession).toHaveBeenCalled();
    expect(failed).toBe(true);

    httpMock.verify();
  });

  it('does not try to refresh failed login requests', () => {
    const refreshSource = new Subject<AuthResponse>();
    const auth = createAuthStub(refreshSource);
    configure(auth);

    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);
    let failed = false;

    http.post('/api/auth/login', { email: 'a@b.com', password: 'wrong' }).subscribe({
      next: () => undefined,
      error: () => {
        failed = true;
      },
    });

    httpMock
      .expectOne('/api/auth/login')
      .flush({ message: 'Invalid email or password' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.refresh).not.toHaveBeenCalled();
    expect(failed).toBe(true);

    httpMock.verify();
  });
});
