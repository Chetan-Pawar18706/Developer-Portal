import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse, PaginatedData } from '../../../core/models/api.model';
import type {
  CreateUserRequest,
  Role,
  User,
  UserListQuery,
} from '../../../core/models/user.model';

@Injectable({ providedIn: 'root' })
export class UserAdminService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  list(query: UserListQuery): Observable<PaginatedData<User>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('limit', query.limit)
      .set('sortBy', query.sortBy || 'createdAt')
      .set('sortOrder', query.sortOrder);

    if (query.search) {
      params = params.set('search', query.search);
    }

    if (query.role) {
      params = params.set('role', query.role);
    }

    if (query.isActive !== undefined) {
      params = params.set('isActive', String(query.isActive));
    }

    return this.http
      .get<ApiResponse<PaginatedData<User>>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }

  create(input: CreateUserRequest): Observable<User> {
    return this.http
      .post<ApiResponse<{ user: User }>>(this.baseUrl, input)
      .pipe(map((response) => response.data.user));
  }

  updateRole(userId: string, role: Role): Observable<User> {
    return this.http
      .patch<ApiResponse<{ user: User }>>(`${this.baseUrl}/${userId}/role`, { role })
      .pipe(map((response) => response.data.user));
  }

  updateStatus(userId: string, isActive: boolean): Observable<User> {
    return this.http
      .patch<ApiResponse<{ user: User }>>(`${this.baseUrl}/${userId}/status`, { isActive })
      .pipe(map((response) => response.data.user));
  }
}
