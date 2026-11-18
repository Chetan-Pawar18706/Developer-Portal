import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, PaginatedData } from '../models/api.model';
import type {
  Notification,
  NotificationListQuery,
} from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notifications`;

  list(query: NotificationListQuery): Observable<PaginatedData<Notification>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('limit', query.limit)
      .set('sortBy', query.sortBy)
      .set('sortOrder', query.sortOrder);

    if (query.unreadOnly !== undefined) {
      params = params.set('unreadOnly', String(query.unreadOnly));
    }

    return this.http
      .get<ApiResponse<PaginatedData<Notification>>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }

  unreadCount(): Observable<number> {
    return this.http
      .get<ApiResponse<{ count: number }>>(`${this.baseUrl}/unread-count`)
      .pipe(map((response) => response.data.count));
  }

  markAsRead(id: string): Observable<Notification> {
    return this.http
      .patch<ApiResponse<{ notification: Notification }>>(
        `${this.baseUrl}/${id}/read`,
        {},
      )
      .pipe(map((response) => response.data.notification));
  }

  markAllAsRead(): Observable<number> {
    return this.http
      .patch<ApiResponse<{ updated: number }>>(`${this.baseUrl}/read-all`, {})
      .pipe(map((response) => response.data.updated));
  }
}
