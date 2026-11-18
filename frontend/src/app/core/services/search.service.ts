import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse } from '../models/api.model';
import type { SearchResult } from '../models/search.model';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/search`;

  search(query: string, limit = 6): Observable<SearchResult> {
    const params = new HttpParams().set('q', query.trim()).set('limit', limit);

    return this.http
      .get<ApiResponse<SearchResult>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }
}
