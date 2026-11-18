import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/api.model';
import type {
  AdminDashboard,
  MeDashboard,
  PmDashboard,
  ProjectDashboard,
} from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getAdmin(): Observable<AdminDashboard> {
    return this.http
      .get<ApiResponse<AdminDashboard>>(`${this.apiUrl}/dashboard/admin`)
      .pipe(map((response) => response.data));
  }

  getMe(): Observable<MeDashboard> {
    return this.http
      .get<ApiResponse<MeDashboard>>(`${this.apiUrl}/dashboard/me`)
      .pipe(map((response) => response.data));
  }

  getProject(projectId: string): Observable<ProjectDashboard> {
    return this.http
      .get<ApiResponse<ProjectDashboard>>(`${this.apiUrl}/projects/${projectId}/dashboard`)
      .pipe(map((response) => response.data));
  }

  getProjectPm(projectId: string): Observable<PmDashboard> {
    return this.http
      .get<ApiResponse<PmDashboard>>(`${this.apiUrl}/projects/${projectId}/dashboard/pm`)
      .pipe(map((response) => response.data));
  }

  downloadProjectReport(projectId: string): Observable<{ blob: Blob; fileName: string }> {
    return this.http
      .get(`${this.apiUrl}/projects/${projectId}/report.pdf`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map((response: HttpResponse<Blob>) => ({
          blob: response.body ?? new Blob(),
          fileName: this.fileNameFrom(response),
        })),
      );
  }

  private fileNameFrom(response: HttpResponse<Blob>): string {
    const header = response.headers.get('content-disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(header);
    return match?.[1] ?? `project-report-${Date.now()}.pdf`;
  }
}
