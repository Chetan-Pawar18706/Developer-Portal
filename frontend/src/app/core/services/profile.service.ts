import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/api.model';
import type { DeveloperProfile, User } from '../models/user.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  getDeveloper(userId: string): Observable<DeveloperProfile> {
    return this.http
      .get<ApiResponse<{ profile: DeveloperProfile }>>(`${this.baseUrl}/${userId}/profile`)
      .pipe(map((response) => response.data.profile));
  }

  uploadAvatar(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('avatar', file);

    return this.http
      .patch<ApiResponse<{ user: User }>>(`${this.baseUrl}/me/avatar`, formData)
      .pipe(
        tap((response) => this.auth.setCurrentUser(response.data.user)),
        map((response) => response.data.user),
      );
  }
}
