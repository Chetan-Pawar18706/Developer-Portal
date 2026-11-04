import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_LABELS,
  type Requirement,
  type RequirementListQuery,
  type RequirementPriority,
  type RequirementStatus,
  type RequirementType,
} from '../../../core/models/requirement.model';
import type { Project } from '../../../core/models/project.model';
import { AuthService } from '../../../core/services/auth.service';
import { ProjectService } from '../../../core/services/project.service';
import { RequirementService } from '../../../core/services/requirement.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { getErrorMessage } from '../../../shared/utils/http-error';

const DEFAULT_FILTERS: RequirementListQuery = {
  search: '',
  projectId: '',
  status: undefined,
  priority: undefined,
  type: undefined,
  page: 1,
  limit: 20,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

@Component({
  selector: 'app-requirement-workspace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatMenuModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    StatusBadgeComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './requirement-workspace.component.html',
  styleUrl: './requirement-workspace.component.scss',
})
export class RequirementWorkspaceComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly projectService = inject(ProjectService);
  private readonly requirementService = inject(RequirementService);
  private readonly router = inject(Router);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly filters = signal<RequirementListQuery>({ ...DEFAULT_FILTERS });
  readonly requirements = signal<readonly Requirement[]>([]);
  readonly projects = signal<readonly Project[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly projectsLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly statuses = REQUIREMENT_STATUSES;
  readonly statusLabels = REQUIREMENT_STATUS_LABELS;
  readonly priorities = REQUIREMENT_PRIORITIES;
  readonly priorityLabels = REQUIREMENT_PRIORITY_LABELS;
  readonly types = REQUIREMENT_TYPES;
  readonly typeLabels = REQUIREMENT_TYPE_LABELS;
  readonly displayColumns = ['title', 'project', 'type', 'priority', 'status', 'updatedAt'];

  readonly creatableProjects = computed(() => {
    const role = this.auth.role();
    const userId = this.auth.currentUser()?.id;

    if (role === 'admin' || role === 'pm') {
      return this.projects();
    }

    if (role === 'client') {
      return this.projects().filter((project) => project.client.id === userId);
    }

    return [];
  });

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.filters().limit))),
  );

  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.filters().page - 1) * this.filters().limit + 1,
  );

  readonly rangeEnd = computed(() =>
    Math.min(this.filters().page * this.filters().limit, this.total()),
  );

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => this.setFilter({ search: value.trim() }));
  }

  ngOnInit(): void {
    this.loadProjects();
    this.loadRequirements();
  }

  onProjectChange(projectId: string): void {
    this.setFilter({ projectId });
  }

  onStatusChange(status: RequirementStatus | ''): void {
    this.setFilter({ status: status || undefined });
  }

  onPriorityChange(priority: RequirementPriority | ''): void {
    this.setFilter({ priority: priority || undefined });
  }

  onTypeChange(type: RequirementType | ''): void {
    this.setFilter({ type: type || undefined });
  }

  onPage(event: PageEvent): void {
    if (event.pageSize !== this.filters().limit) {
      this.filters.update((filters) => ({ ...filters, limit: event.pageSize, page: 1 }));
      this.loadRequirements();
      return;
    }

    this.filters.update((filters) => ({ ...filters, page: event.pageIndex + 1 }));
    this.loadRequirements();
  }

  reload(): void {
    this.loadRequirements();
  }

  openRequirement(requirement: Requirement): void {
    void this.router.navigate([
      '/projects',
      requirement.projectId,
      'requirements',
      requirement.id,
    ]);
  }

  createRequirement(project: Project): void {
    void this.router.navigate(['/projects', project.id, 'requirements', 'new']);
  }

  projectName(requirement: Requirement): string {
    return (
      requirement.projectTitle ||
      this.projects().find((project) => project.id === requirement.projectId)?.title ||
      'Project'
    );
  }

  statusLabel(status: RequirementStatus): string {
    return this.statusLabels[status];
  }

  priorityLabel(priority: RequirementPriority): string {
    return this.priorityLabels[priority];
  }

  typeLabel(type: RequirementType): string {
    return this.typeLabels[type];
  }

  private setFilter(partial: Partial<RequirementListQuery>): void {
    this.filters.update((filters) => ({ ...filters, ...partial, page: 1 }));
    this.loadRequirements();
  }

  private loadProjects(): void {
    this.projectsLoading.set(true);

    this.projectService
      .list({
        search: '',
        page: 1,
        limit: 100,
        sortBy: 'title',
        sortOrder: 'asc',
      })
      .subscribe({
        next: (result) => {
          this.projects.set(result.data);
          this.projectsLoading.set(false);
        },
        error: () => {
          this.projectsLoading.set(false);
        },
      });
  }

  private loadRequirements(): void {
    const filters = this.filters();

    this.loading.set(true);
    this.error.set(null);

    this.requirementService
      .listAll({
        ...filters,
        projectId: filters.projectId || undefined,
      })
      .subscribe({
        next: (result) => {
          this.requirements.set(result.data);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(getErrorMessage(error, 'Unable to load requirements.'));
          this.loading.set(false);
        },
      });
  }
}
