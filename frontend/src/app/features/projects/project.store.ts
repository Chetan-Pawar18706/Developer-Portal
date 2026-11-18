import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import type {
  AddProjectMemberRequest,
  CreateProjectRequest,
  Project,
  ProjectActivity,
  ProjectFilters,
  ProjectPriority,
  ProjectStatus,
  SignOffProjectRequest,
  UpdateProjectStatusRequest,
} from '../../core/models/project.model';
import { getErrorMessage } from '../../shared/utils/http-error';
import { ProjectService } from '../../core/services/project.service';

const DEFAULT_FILTERS: ProjectFilters = {
  search: '',
  status: '',
  priority: '',
  page: 1,
  limit: 12,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

@Injectable({ providedIn: 'root' })
export class ProjectStore {
  private readonly projectService = inject(ProjectService);

  readonly entities = signal<readonly Project[]>([]);
  readonly selected = signal<Project | null>(null);
  readonly activity = signal<readonly ProjectActivity[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly activityLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly filters = signal<ProjectFilters>({ ...DEFAULT_FILTERS });

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.filters().limit))),
  );

  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.filters().page - 1) * this.filters().limit + 1,
  );

  readonly rangeEnd = computed(() =>
    Math.min(this.filters().page * this.filters().limit, this.total()),
  );

  load(): void {
    const { search, status, priority, page, limit, sortBy, sortOrder } = this.filters();

    this.loading.set(true);
    this.error.set(null);

    this.projectService
      .list({
        search,
        status: status || undefined,
        priority: priority || undefined,
        page,
        limit,
        sortBy,
        sortOrder,
      })
      .subscribe({
        next: (result) => {
          this.entities.set(result.data);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(getErrorMessage(error, 'Unable to load projects.'));
          this.loading.set(false);
        },
      });
  }

  setSearch(search: string): void {
    this.filters.update((filters) => ({ ...filters, search, page: 1 }));
    this.load();
  }

  setStatus(status: ProjectStatus | ''): void {
    this.filters.update((filters) => ({ ...filters, status, page: 1 }));
    this.load();
  }

  setPriority(priority: ProjectPriority | ''): void {
    this.filters.update((filters) => ({ ...filters, priority, page: 1 }));
    this.load();
  }

  setPage(page: number): void {
    this.filters.update((filters) => ({
      ...filters,
      page: Math.min(Math.max(1, page), this.pageCount()),
    }));
    this.load();
  }

  setPageSize(limit: number): void {
    this.filters.update((filters) => ({ ...filters, limit, page: 1 }));
    this.load();
  }

  loadOne(projectId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.projectService.get(projectId).subscribe({
      next: (project) => {
        this.selected.set(project);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.selected.set(null);
        this.error.set(getErrorMessage(error, 'Unable to load this project.'));
        this.loading.set(false);
      },
    });
  }

  clearSelected(): void {
    this.selected.set(null);
    this.activity.set([]);
  }

  loadActivity(projectId: string): void {
    this.activityLoading.set(true);

    this.projectService.getActivity(projectId).subscribe({
      next: (activity) => {
        this.activity.set(activity);
        this.activityLoading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to load project activity.'));
        this.activityLoading.set(false);
      },
    });
  }

  create(input: CreateProjectRequest): Observable<Project> {
    return this.projectService.create(input).pipe(tap((project) => this.applyProject(project)));
  }

  changeStatus(
    projectId: string,
    input: UpdateProjectStatusRequest,
  ): Observable<Project> {
    return this.projectService
      .updateStatus(projectId, input)
      .pipe(tap((project) => this.applyProject(project)));
  }

  signOff(projectId: string, input: SignOffProjectRequest): Observable<Project> {
    return this.projectService.signOff(projectId, input).pipe(
      tap((project) => {
        this.applyProject(project);
        this.loadActivity(projectId);
      }),
    );
  }

  addMember(projectId: string, member: AddProjectMemberRequest): Observable<Project> {
    return this.projectService.addMember(projectId, member).pipe(
      tap((project) => {
        this.applyProject(project);
        this.loadActivity(projectId);
      }),
    );
  }

  removeMember(projectId: string, userId: string): Observable<Project> {
    return this.projectService.removeMember(projectId, userId).pipe(
      tap((project) => {
        this.applyProject(project);
        this.loadActivity(projectId);
      }),
    );
  }

  archive(projectId: string): Observable<Project> {
    return this.projectService.archive(projectId).pipe(
      tap((project) => {
        this.applyProject(project);
        this.loadActivity(projectId);
      }),
    );
  }

  private applyProject(project: Project): void {
    this.selected.update((selected) => (selected?.id === project.id ? project : selected));

    this.entities.update((entities) =>
      entities.map((entity) => (entity.id === project.id ? project : entity)),
    );
  }
}
