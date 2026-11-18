import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import type {
  CreateIssueRequest,
  Issue,
  IssueFilters,
  IssueSeverity,
  IssueStatus,
  IssueType,
  UpdateIssueRequest,
  UpdateIssueStatusRequest,
} from '../../core/models/issue.model';
import { IssueService } from '../../core/services/issue.service';
import type { Task } from '../../core/models/task.model';
import { getErrorMessage } from '../../shared/utils/http-error';

const DEFAULT_FILTERS: IssueFilters = {
  search: '',
  type: '',
  severity: '',
  status: '',
  assignedTo: '',
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

@Injectable({ providedIn: 'root' })
export class IssueStore {
  private readonly issueService = inject(IssueService);
  private readonly projectId = signal('');

  readonly entities = signal<readonly Issue[]>([]);
  readonly selected = signal<Issue | null>(null);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly selectedLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly filters = signal<IssueFilters>({ ...DEFAULT_FILTERS });

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.filters().limit))),
  );

  load(projectId: string): void {
    if (this.projectId() !== projectId) {
      this.projectId.set(projectId);
      this.filters.set({ ...DEFAULT_FILTERS });
    }

    const { search, type, severity, status, assignedTo, page, limit, sortBy, sortOrder } =
      this.filters();

    this.loading.set(true);
    this.error.set(null);

    this.issueService
      .list(projectId, {
        search,
        type: type || undefined,
        severity: severity || undefined,
        status: status || undefined,
        assignedTo: assignedTo || undefined,
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
          this.error.set(getErrorMessage(error, 'Unable to load issues.'));
          this.loading.set(false);
        },
      });
  }

  reload(): void {
    if (this.projectId()) {
      this.load(this.projectId());
    }
  }

  setSearch(search: string): void {
    this.filters.update((filters) => ({ ...filters, search, page: 1 }));
    this.reload();
  }

  setType(type: IssueType | ''): void {
    this.filters.update((filters) => ({ ...filters, type, page: 1 }));
    this.reload();
  }

  setSeverity(severity: IssueSeverity | ''): void {
    this.filters.update((filters) => ({ ...filters, severity, page: 1 }));
    this.reload();
  }

  setStatus(status: IssueStatus | ''): void {
    this.filters.update((filters) => ({ ...filters, status, page: 1 }));
    this.reload();
  }

  setAssignee(assignedTo: string): void {
    this.filters.update((filters) => ({ ...filters, assignedTo, page: 1 }));
    this.reload();
  }

  setPage(page: number): void {
    this.filters.update((filters) => ({
      ...filters,
      page: Math.min(Math.max(1, page), this.pageCount()),
    }));
    this.reload();
  }

  setPageSize(limit: number): void {
    this.filters.update((filters) => ({ ...filters, limit, page: 1 }));
    this.reload();
  }

  loadOne(issueId: string): void {
    this.selectedLoading.set(true);
    this.error.set(null);

    this.issueService.get(issueId).subscribe({
      next: (issue) => {
        this.selected.set(issue);
        this.selectedLoading.set(false);
      },
      error: (error: unknown) => {
        this.selected.set(null);
        this.error.set(getErrorMessage(error, 'Unable to load this issue.'));
        this.selectedLoading.set(false);
      },
    });
  }

  clearSelected(): void {
    this.selected.set(null);
  }

  create(projectId: string, input: CreateIssueRequest): Observable<Issue> {
    return this.issueService
      .create(projectId, input)
      .pipe(tap((issue) => this.applyIssue(issue)));
  }

  changeStatus(
    issueId: string,
    input: UpdateIssueStatusRequest,
  ): Observable<Issue> {
    return this.issueService
      .changeStatus(issueId, input)
      .pipe(tap((issue) => this.applyIssue(issue)));
  }

  assign(issueId: string, assigneeId: string | null): Observable<Issue> {
    return this.issueService
      .update(issueId, { assignedTo: assigneeId })
      .pipe(tap((issue) => this.applyIssue(issue)));
  }

  convertToTask(issueId: string): Observable<Task> {
    return this.issueService.convertToTask(issueId);
  }

  private applyIssue(issue: Issue): void {
    this.selected.update((selected) => (selected?.id === issue.id ? issue : selected));

    this.entities.update((entities) => {
      const existing = entities.some((entity) => entity.id === issue.id);
      return existing
        ? entities.map((entity) => (entity.id === issue.id ? issue : entity))
        : [issue, ...entities];
    });
  }
}
