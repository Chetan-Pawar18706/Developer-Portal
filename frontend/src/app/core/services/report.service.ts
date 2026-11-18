import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/api.model';
import type { PortfolioReport, ReportQuery } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reports`;

  get(query: ReportQuery = {}): Observable<PortfolioReport> {
    let params = new HttpParams();

    if (query.projectId) {
      params = params.set('projectId', query.projectId);
    }

    return this.http
      .get<ApiResponse<PortfolioReport>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }
}
