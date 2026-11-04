import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/api.model';
import type { Role } from '../models/user.model';

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserDirectoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users/lookup`;

  lookup(roles: readonly Role[] = []): Observable<DirectoryUser[]> {
    let params = new HttpParams();

    if (roles.length > 0) {
      params = params.set('role', roles.join(','));
    }

    return this.http
      .get<ApiResponse<{ users: DirectoryUser[] }>>(this.baseUrl, { params })
      .pipe(map((response) => response.data.users));
  }
}
