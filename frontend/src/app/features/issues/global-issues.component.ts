import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import type {
  GlobalIssueListQuery,
  Issue,
  IssueSeverity,
  IssueStatus,
  IssueType,
} from '../../core/models/issue.model';
import {
  ISSUE_SEVERITIES,
  ISSUE_SEVERITY_LABELS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
} from '../../core/models/issue.model';
import type {
  Project,
  ProjectListQuery,
  ProjectUserSummary,
} from '../../core/models/project.model';
import { IssueService } from '../../core/services/issue.service';
import { ProjectService } from '../../core/services/project.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { getErrorMessage } from '../../shared/utils/http-error';

const DEFAULT_FILTERS: GlobalIssueListQuery = {
  search: '',
  projectId: '',
  assignedTo: '',
  page: 1,
  limit: 20,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

@Component({
  selector: 'app-global-issues',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    UserAvatarComponent,
  ],
  templateUrl: './global-issues.component.html',
  styleUrl: './global-issues.component.scss',
})
export class GlobalIssuesComponent implements OnInit {
  private readonly issueService = inject(IssueService);
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly filters = signal<GlobalIssueListQuery>({ ...DEFAULT_FILTERS });
  readonly issues = signal<readonly Issue[]>([]);
  readonly projects = signal<readonly Project[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly types = ISSUE_TYPES;
  readonly typeLabels = ISSUE_TYPE_LABELS;
  readonly severities = ISSUE_SEVERITIES;
  readonly severityLabels = ISSUE_SEVERITY_LABELS;
  readonly statuses = ISSUE_STATUSES;
  readonly statusLabels = ISSUE_STATUS_LABELS;
  readonly displayColumns = [
    'title',
    'project',
    'severity',
    'status',
    'assignee',
    'age',
    'updatedAt',
  ];

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.filters().limit))),
  );
  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.filters().page - 1) * this.filters().limit + 1,
  );
  readonly rangeEnd = computed(() =>
    Math.min(this.filters().page * this.filters().limit, this.total()),
  );

  readonly availableUsers = computed<readonly ProjectUserSummary[]>(() => {
    const projectId = this.filters().projectId;
    const projects = projectId
      ? this.projects().filter((project) => project.id === projectId)
      : this.projects();
    const users = new Map<string, ProjectUserSummary>();

    for (const project of projects) {
      users.set(project.client.id, project.client);

      for (const member of project.members) {
        users.set(member.user.id, member.user);
      }
    }

    return [...users.values()].sort((left, right) => left.name.localeCompare(right.name));
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => this.setFilters({ search: value.trim(), page: 1 }));
  }

  ngOnInit(): void {
    this.loadProjects();
    this.loadIssues();
  }

  onProjectChange(projectId: string): void {
    this.setFilters({ projectId, assignedTo: '', page: 1 });
  }

  onAssigneeChange(assignedTo: string): void {
    this.setFilters({ assignedTo: assignedTo || undefined, page: 1 });
  }

  onTypeChange(type: IssueType | ''): void {
    this.setFilters({ type: type || undefined, page: 1 });
  }

  onSeverityChange(severity: IssueSeverity | ''): void {
    this.setFilters({ severity: severity || undefined, page: 1 });
  }

  onStatusChange(status: IssueStatus | ''): void {
    this.setFilters({ status: status || undefined, page: 1 });
  }

  onPage(event: PageEvent): void {
    if (event.pageSize !== this.filters().limit) {
      this.filters.update((filters) => ({ ...filters, limit: event.pageSize, page: 1 }));
      this.loadIssues();
      return;
    }

    this.filters.update((filters) => ({ ...filters, page: event.pageIndex + 1 }));
    this.loadIssues();
  }

  reload(): void {
    this.loadIssues();
  }

  typeLabel(type: IssueType): string {
    return this.typeLabels[type];
  }

  severityLabel(severity: IssueSeverity): string {
    return this.severityLabels[severity];
  }

  statusLabel(status: IssueStatus): string {
    return this.statusLabels[status];
  }

  daysOpen(issue: Issue): number {
    const end = issue.status === 'closed' ? new Date(issue.updatedAt) : new Date();
    const started = new Date(issue.createdAt).getTime();
    return Math.max(0, Math.floor((end.getTime() - started) / 86_400_000));
  }

  ageTone(issue: Issue): string {
    const days = this.daysOpen(issue);

    if (issue.status === 'closed') {
      return 'closed';
    }

    if (days >= 14) {
      return 'critical';
    }

    if (days >= 7) {
      return 'stale';
    }

    if (days >= 3) {
      return 'aging';
    }

    return 'fresh';
  }

  openIssue(issue: Issue): void {
    void this.router.navigate(['/projects', issue.projectId, 'issues', issue.id]);
  }

  openProject(issue: Issue, event: Event): void {
    event.stopPropagation();
    void this.router.navigate(['/projects', issue.projectId, 'issues']);
  }

  private setFilters(patch: Partial<GlobalIssueListQuery>): void {
    this.filters.update((filters) => ({ ...filters, ...patch }));
    this.loadIssues();
  }

  private loadProjects(): void {
    const query: ProjectListQuery = {
      search: '',
      page: 1,
      limit: 100,
      sortBy: 'title',
      sortOrder: 'asc',
    };

    this.projectService.list(query).subscribe({
      next: (result) => this.projects.set(result.data),
      error: () => this.projects.set([]),
    });
  }

  private loadIssues(): void {
    this.loading.set(true);
    this.error.set(null);

    this.issueService.listAll(this.filters()).subscribe({
      next: (result) => {
        this.issues.set(result.data);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to load issues.'));
        this.issues.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }
}
