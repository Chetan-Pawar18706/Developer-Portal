import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { DeveloperProfile, User } from '../models/user.model';
import { AuthService } from './auth.service';
import { ProfileService } from './profile.service';

const profile: DeveloperProfile = {
  id: '507f1f77bcf86cd799439011',
  name: 'Raghav Shastri',
  role: 'developer',
  avatar: '/api/users/507f1f77bcf86cd799439011/avatar',
  jobTitle: 'Senior Developer',
  company: 'Dev Portal',
  location: 'Pune, India',
  bio: 'I build reliable products.',
  skills: ['Angular', 'Node.js'],
  website: 'https://example.com',
  github: 'raghavshastri',
  linkedin: 'https://www.linkedin.com/in/raghavshastri',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const currentUser: User = {
  ...profile,
  email: 'raghav@example.com',
  isActive: true,
  notificationPrefs: {
    emailOnAssignment: true,
    emailOnMention: true,
    emailOnStatusChange: true,
    emailOnReminder: true,
  },
  theme: 'light',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;
  let authStub: { setCurrentUser: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authStub = { setCurrentUser: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
      ],
    });

    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads another user public developer profile', () => {
    let result: DeveloperProfile | null = null;
    service.getDeveloper(profile.id).subscribe((value) => (result = value));

    const request = httpMock.expectOne(`${environment.apiUrl}/users/${profile.id}/profile`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { profile }, message: 'Developer profile retrieved' });

    expect(result).toEqual(profile);
  });

  it('uploads an avatar as multipart data and updates the current user', () => {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    let result: User | null = null;
    service.uploadAvatar(file).subscribe((value) => (result = value));

    const request = httpMock.expectOne(`${environment.apiUrl}/users/me/avatar`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body instanceof FormData).toBe(true);
    expect((request.request.body as FormData).get('avatar')).toBe(file);
    request.flush({ success: true, data: { user: currentUser }, message: 'Profile picture updated' });

    expect(result).toEqual(currentUser);
    expect(authStub.setCurrentUser).toHaveBeenCalledWith(currentUser);
  });
});
