import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, PaginatedData } from '../models/api.model';
import type {
  CreateChangeRequestRequest,
  CreateRequirementRequest,
  Requirement,
  RequirementListQuery,
  UpdateRequirementRequest,
  UpdateRequirementStatusRequest,
} from '../models/requirement.model';

@Injectable({ providedIn: 'root' })
export class RequirementService {
  private readonly http = inject(HttpClient);
  private readonly projectBaseUrl = `${environment.apiUrl}/projects`;
  private readonly baseUrl = `${environment.apiUrl}/requirements`;

  list(projectId: string, query: RequirementListQuery): Observable<PaginatedData<Requirement>> {
    return this.http
      .get<ApiResponse<PaginatedData<Requirement>>>(
        `${this.projectBaseUrl}/${projectId}/requirements`,
        { params: this.buildListParams(query) },
      )
      .pipe(map((response) => response.data));
  }

  listAll(query: RequirementListQuery): Observable<PaginatedData<Requirement>> {
    let params = this.buildListParams(query);

    if (query.projectId) {
      params = params.set('projectId', query.projectId);
    }

    return this.http
      .get<ApiResponse<PaginatedData<Requirement>>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }

  get(requirementId: string): Observable<Requirement> {
    return this.http
      .get<ApiResponse<{ requirement: Requirement }>>(`${this.baseUrl}/${requirementId}`)
      .pipe(map((response) => response.data.requirement));
  }

  create(projectId: string, input: CreateRequirementRequest): Observable<Requirement> {
    return this.http
      .post<ApiResponse<{ requirement: Requirement }>>(
        `${this.projectBaseUrl}/${projectId}/requirements`,
        input,
      )
      .pipe(map((response) => response.data.requirement));
  }

  update(requirementId: string, input: UpdateRequirementRequest): Observable<Requirement> {
    return this.http
      .patch<ApiResponse<{ requirement: Requirement }>>(`${this.baseUrl}/${requirementId}`, input)
      .pipe(map((response) => response.data.requirement));
  }

  updateStatus(
    requirementId: string,
    input: UpdateRequirementStatusRequest,
  ): Observable<Requirement> {
    return this.http
      .patch<ApiResponse<{ requirement: Requirement }>>(
        `${this.baseUrl}/${requirementId}/status`,
        input,
      )
      .pipe(map((response) => response.data.requirement));
  }

  createChangeRequest(
    requirementId: string,
    input: CreateChangeRequestRequest,
  ): Observable<Requirement> {
    return this.http
      .post<ApiResponse<{ requirement: Requirement }>>(
        `${this.baseUrl}/${requirementId}/change-request`,
        input,
      )
      .pipe(map((response) => response.data.requirement));
  }

  private buildListParams(query: RequirementListQuery): HttpParams {
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

    if (query.type) {
      params = params.set('type', query.type);
    }

    return params;
  }
}
