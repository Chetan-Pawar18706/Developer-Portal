import { HttpClient, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ApiResponse, PaginatedData } from '../models/api.model';
import type { FileFolder, FileListQuery, ProjectFile } from '../models/file.model';

export type FileUploadEvent =
  | { kind: 'progress'; progress: number }
  | { kind: 'complete'; file: ProjectFile };

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/files`;
  private readonly projectsUrl = `${environment.apiUrl}/projects`;

  list(projectId: string, query: FileListQuery = {}): Observable<PaginatedData<ProjectFile>> {
    let params = new HttpParams()
      .set('page', query.page ?? 1)
      .set('limit', query.limit ?? 100);

    if (query.folder) {
      params = params.set('folder', query.folder);
    }

    if (query.search) {
      params = params.set('search', query.search);
    }

    if (query.sortBy) {
      params = params.set('sortBy', query.sortBy);
    }

    if (query.sortOrder) {
      params = params.set('sortOrder', query.sortOrder);
    }

    return this.http
      .get<ApiResponse<PaginatedData<ProjectFile>>>(
        `${this.projectsUrl}/${projectId}/files`,
        { params },
      )
      .pipe(map((response) => response.data));
  }

  upload(
    projectId: string,
    file: File,
    folder: FileFolder,
    isInternal: boolean,
  ): Observable<FileUploadEvent> {
    const form = new FormData();
    form.append('files', file);
    form.append('folder', folder);
    form.append('isInternal', String(isInternal));

    return this.http
      .post<ApiResponse<{ files: ProjectFile[] }>>(
        `${this.projectsUrl}/${projectId}/files`,
        form,
        { reportProgress: true, observe: 'events' },
      )
      .pipe(
        filter((event) => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
        map((event): FileUploadEvent => {
          if (event.type === HttpEventType.UploadProgress) {
            return {
              kind: 'progress',
              progress: event.total ? Math.round((event.loaded / event.total) * 100) : 100,
            };
          }

          if (event.type === HttpEventType.Response) {
            return { kind: 'complete', file: event.body!.data.files[0] };
          }

          return { kind: 'progress', progress: 100 };
        }),
      );
  }

  addVersion(fileId: string, file: File): Observable<ProjectFile> {
    const form = new FormData();
    form.append('file', file);

    return this.http
      .post<ApiResponse<{ file: ProjectFile }>>(`${this.baseUrl}/${fileId}/new-version`, form)
      .pipe(map((response) => response.data.file));
  }

  download(fileId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${fileId}/download`, { responseType: 'blob' });
  }

  preview(fileId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${fileId}/preview`, { responseType: 'blob' });
  }

  delete(fileId: string): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.baseUrl}/${fileId}`)
      .pipe(map(() => undefined));
  }
}
