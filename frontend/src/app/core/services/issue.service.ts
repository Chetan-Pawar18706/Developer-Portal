import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, PaginatedData } from '../models/api.model';
import type {
  CreateIssueRequest,
  GlobalIssueListQuery,
  Issue,
  IssueListQuery,
  UpdateIssueRequest,
  UpdateIssueStatusRequest,
} from '../models/issue.model';
import type { Task } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class IssueService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/issues`;
  private readonly projectsUrl = `${environment.apiUrl}/projects`;

  list(projectId: string, query: IssueListQuery): Observable<PaginatedData<Issue>> {
    return this.http
      .get<ApiResponse<PaginatedData<Issue>>>(`${this.projectsUrl}/${projectId}/issues`, {
        params: this.buildListParams(query),
      })
      .pipe(map((response) => response.data));
  }

  listAll(query: GlobalIssueListQuery): Observable<PaginatedData<Issue>> {
    return this.http
      .get<ApiResponse<PaginatedData<Issue>>>(this.baseUrl, {
        params: this.buildListParams(query),
      })
      .pipe(map((response) => response.data));
  }

  private buildListParams(query: GlobalIssueListQuery): HttpParams {
    let params = new HttpParams()
      .set('page', query.page)
      .set('limit', query.limit)
      .set('sortBy', query.sortBy)
      .set('sortOrder', query.sortOrder);

    if (query.search) {
      params = params.set('search', query.search);
    }

    if (query.type) {
      params = params.set('type', query.type);
    }

    if (query.severity) {
      params = params.set('severity', query.severity);
    }

    if (query.status) {
      params = params.set('status', query.status);
    }

    if (query.assignedTo) {
      params = params.set('assignedTo', query.assignedTo);
    }

    if (query.projectId) {
      params = params.set('projectId', query.projectId);
    }

    return params;
  }

  create(projectId: string, input: CreateIssueRequest): Observable<Issue> {
    return this.http
      .post<ApiResponse<{ issue: Issue }>>(`${this.projectsUrl}/${projectId}/issues`, input)
      .pipe(map((response) => response.data.issue));
  }

  get(issueId: string): Observable<Issue> {
    return this.http
      .get<ApiResponse<{ issue: Issue }>>(`${this.baseUrl}/${issueId}`)
      .pipe(map((response) => response.data.issue));
  }

  update(issueId: string, input: UpdateIssueRequest): Observable<Issue> {
    return this.http
      .patch<ApiResponse<{ issue: Issue }>>(`${this.baseUrl}/${issueId}`, input)
      .pipe(map((response) => response.data.issue));
  }

  changeStatus(issueId: string, input: UpdateIssueStatusRequest): Observable<Issue> {
    return this.http
      .patch<ApiResponse<{ issue: Issue }>>(`${this.baseUrl}/${issueId}/status`, input)
      .pipe(map((response) => response.data.issue));
  }

  convertToTask(issueId: string): Observable<Task> {
    return this.http
      .post<ApiResponse<{ task: Task }>>(`${this.baseUrl}/${issueId}/convert-to-task`, {})
      .pipe(map((response) => response.data.task));
  }
}
