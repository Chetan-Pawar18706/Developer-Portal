import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, PaginatedData } from '../models/api.model';
import type {
  Comment,
  CommentEntityType,
  CommentListQuery,
  GlobalCommentListQuery,
  CreateCommentRequest,
  ToggleReactionRequest,
  UpdateCommentRequest,
} from '../models/comment.model';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/comments`;

  list(
    entityType: CommentEntityType,
    entityId: string,
    query: CommentListQuery = { page: 1, limit: 100 },
  ): Observable<PaginatedData<Comment>> {
    const params = new HttpParams()
      .set('entityType', entityType)
      .set('entityId', entityId)
      .set('page', query.page)
      .set('limit', query.limit);

    return this.http
      .get<ApiResponse<PaginatedData<Comment>>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }

  listGlobal(query: GlobalCommentListQuery): Observable<PaginatedData<Comment>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('limit', query.limit);

    if (query.projectId) {
      params = params.set('projectId', query.projectId);
    }

    if (query.entityType) {
      params = params.set('entityType', query.entityType);
    }

    if (query.search) {
      params = params.set('search', query.search);
    }

    return this.http
      .get<ApiResponse<PaginatedData<Comment>>>(`${this.baseUrl}/global`, { params })
      .pipe(map((response) => response.data));
  }

  create(input: CreateCommentRequest): Observable<Comment> {
    return this.http
      .post<ApiResponse<{ comment: Comment }>>(this.baseUrl, input)
      .pipe(map((response) => response.data.comment));
  }

  update(commentId: string, input: UpdateCommentRequest): Observable<Comment> {
    return this.http
      .patch<ApiResponse<{ comment: Comment }>>(`${this.baseUrl}/${commentId}`, input)
      .pipe(map((response) => response.data.comment));
  }

  delete(commentId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.baseUrl}/${commentId}`)
      .pipe(map(() => undefined));
  }

  react(commentId: string, input: ToggleReactionRequest): Observable<Comment> {
    return this.http
      .post<ApiResponse<{ comment: Comment }>>(`${this.baseUrl}/${commentId}/reactions`, input)
      .pipe(map((response) => response.data.comment));
  }
}
