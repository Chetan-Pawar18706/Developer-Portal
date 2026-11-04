import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, PaginatedData } from '../models/api.model';
import type {
  AddProjectMemberRequest,
  CreateProjectRequest,
  Project,
  ProjectActivity,
  ProjectListQuery,
  UpdateProjectRequest,
  UpdateProjectStatusRequest,
} from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/projects`;

  list(query: ProjectListQuery): Observable<PaginatedData<Project>> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('limit', query.limit)
      .set('sortBy', query.sortBy)
      .set('sortOrder', query.sortOrder);

    if (query.search) {
      params = params.set('search', query.search);
    }

    if (query.status) {
      params = params.set('status', query.status);
    }

    if (query.priority) {
      params = params.set('priority', query.priority);
    }

    return this.http
      .get<ApiResponse<PaginatedData<Project>>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }

  get(projectId: string): Observable<Project> {
    return this.http
      .get<ApiResponse<{ project: Project }>>(`${this.baseUrl}/${projectId}`)
      .pipe(map((response) => response.data.project));
  }

  create(input: CreateProjectRequest): Observable<Project> {
    return this.http
      .post<ApiResponse<{ project: Project }>>(this.baseUrl, input)
      .pipe(map((response) => response.data.project));
  }

  update(projectId: string, input: UpdateProjectRequest): Observable<Project> {
    return this.http
      .patch<ApiResponse<{ project: Project }>>(`${this.baseUrl}/${projectId}`, input)
      .pipe(map((response) => response.data.project));
  }

  archive(projectId: string): Observable<Project> {
    return this.http
      .delete<ApiResponse<{ project: Project }>>(`${this.baseUrl}/${projectId}`)
      .pipe(map((response) => response.data.project));
  }

  addMember(projectId: string, member: AddProjectMemberRequest): Observable<Project> {
    return this.http
      .post<ApiResponse<{ project: Project }>>(`${this.baseUrl}/${projectId}/members`, member)
      .pipe(map((response) => response.data.project));
  }

  removeMember(projectId: string, userId: string): Observable<Project> {
    return this.http
      .delete<ApiResponse<{ project: Project }>>(
        `${this.baseUrl}/${projectId}/members/${userId}`,
      )
      .pipe(map((response) => response.data.project));
  }

  updateStatus(
    projectId: string,
    input: UpdateProjectStatusRequest,
  ): Observable<Project> {
    return this.http
      .patch<ApiResponse<{ project: Project }>>(
        `${this.baseUrl}/${projectId}/status`,
        input,
      )
      .pipe(map((response) => response.data.project));
  }

  getActivity(projectId: string): Observable<ProjectActivity[]> {
    return this.http
      .get<ApiResponse<{ activities: ProjectActivity[] }>>(
        `${this.baseUrl}/${projectId}/activity`,
      )
      .pipe(map((response) => response.data.activities));
  }
}
