import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, PaginatedData } from '../models/api.model';
import type {
  AddTimeLogRequest,
  ClientReviewRequest,
  CreateTaskRequest,
  MoveTaskRequest,
  RequirementTaskProgress,
  Task,
  TaskListQuery,
  UpdateSubtasksRequest,
  UpdateTaskRequest,
} from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly projectBaseUrl = `${environment.apiUrl}/projects`;
  private readonly baseUrl = `${environment.apiUrl}/tasks`;
  private readonly requirementBaseUrl = `${environment.apiUrl}/requirements`;

  list(projectId: string, query: TaskListQuery): Observable<PaginatedData<Task>> {
    return this.http
      .get<ApiResponse<PaginatedData<Task>>>(`${this.projectBaseUrl}/${projectId}/tasks`, {
        params: this.buildListParams(query),
      })
      .pipe(map((response) => response.data));
  }

  get(taskId: string): Observable<Task> {
    return this.http
      .get<ApiResponse<{ task: Task }>>(`${this.baseUrl}/${taskId}`)
      .pipe(map((response) => response.data.task));
  }

  create(projectId: string, input: CreateTaskRequest): Observable<Task> {
    return this.http
      .post<ApiResponse<{ task: Task }>>(`${this.projectBaseUrl}/${projectId}/tasks`, input)
      .pipe(map((response) => response.data.task));
  }

  update(taskId: string, input: UpdateTaskRequest): Observable<Task> {
    return this.http
      .patch<ApiResponse<{ task: Task }>>(`${this.baseUrl}/${taskId}`, input)
      .pipe(map((response) => response.data.task));
  }

  move(taskId: string, input: MoveTaskRequest): Observable<Task> {
    return this.http
      .patch<ApiResponse<{ task: Task }>>(`${this.baseUrl}/${taskId}/move`, input)
      .pipe(map((response) => response.data.task));
  }

  delete(taskId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.baseUrl}/${taskId}`)
      .pipe(map(() => undefined));
  }

  addTimeLog(taskId: string, input: AddTimeLogRequest): Observable<Task> {
    return this.http
      .post<ApiResponse<{ task: Task }>>(`${this.baseUrl}/${taskId}/time-logs`, input)
      .pipe(map((response) => response.data.task));
  }

  updateSubtasks(taskId: string, input: UpdateSubtasksRequest): Observable<Task> {
    return this.http
      .patch<ApiResponse<{ task: Task }>>(`${this.baseUrl}/${taskId}/subtasks`, input)
      .pipe(map((response) => response.data.task));
  }

  clientReview(taskId: string, input: ClientReviewRequest): Observable<Task> {
    return this.http
      .post<ApiResponse<{ task: Task }>>(`${this.baseUrl}/${taskId}/client-review`, input)
      .pipe(map((response) => response.data.task));
  }

  getRequirementProgress(requirementId: string): Observable<RequirementTaskProgress> {
    return this.http
      .get<ApiResponse<{ progress: RequirementTaskProgress }>>(
        `${this.requirementBaseUrl}/${requirementId}/progress`,
      )
      .pipe(map((response) => response.data.progress));
  }

  private buildListParams(query: TaskListQuery): HttpParams {
    let params = new HttpParams()
      .set('page', query.page)
      .set('limit', query.limit)
      .set('sortBy', query.sortBy)
      .set('sortOrder', query.sortOrder);

    if (query.search) {
      params = params.set('search', query.search);
    }

    if (query.assignee) {
      params = params.set('assignee', query.assignee);
    }

    if (query.label) {
      params = params.set('label', query.label);
    }

    if (query.priority) {
      params = params.set('priority', query.priority);
    }

    if (query.status) {
      params = params.set('status', query.status);
    }

    if (query.dueFrom) {
      params = params.set('dueFrom', query.dueFrom);
    }

    if (query.dueTo) {
      params = params.set('dueTo', query.dueTo);
    }

    return params;
  }
}
