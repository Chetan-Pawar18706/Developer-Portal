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
import type { Project, ProjectListQuery } from '../../core/models/project.model';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type GlobalTaskListQuery,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../../core/models/task.model';
import { ProjectService } from '../../core/services/project.service';
import { TaskService } from '../../core/services/task.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { getErrorMessage } from '../../shared/utils/http-error';

const DEFAULT_FILTERS: GlobalTaskListQuery = {
  search: '',
  assignee: '',
  label: '',
  projectId: '',
  page: 1,
  limit: 20,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

@Component({
  selector: 'app-global-tasks',
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
  templateUrl: './global-tasks.component.html',
  styleUrl: './global-tasks.component.scss',
})
export class GlobalTasksComponent implements OnInit {
  private readonly taskService = inject(TaskService);
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly filters = signal<GlobalTaskListQuery>({ ...DEFAULT_FILTERS });
  readonly tasks = signal<readonly Task[]>([]);
  readonly projects = signal<readonly Project[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly statuses = TASK_STATUSES;
  readonly statusLabels = TASK_STATUS_LABELS;
  readonly priorities = TASK_PRIORITIES;
  readonly priorityLabels = TASK_PRIORITY_LABELS;
  readonly displayColumns = [
    'title',
    'project',
    'assignee',
    'priority',
    'status',
    'dueDate',
    'hours',
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
    this.loadTasks();
  }

  onProjectChange(projectId: string): void {
    this.setFilters({ projectId, page: 1 });
  }

  onStatusChange(status: TaskStatus | ''): void {
    this.setFilters({ status: status || undefined, page: 1 });
  }

  onPriorityChange(priority: TaskPriority | ''): void {
    this.setFilters({ priority: priority || undefined, page: 1 });
  }

  onPage(event: PageEvent): void {
    if (event.pageSize !== this.filters().limit) {
      this.filters.update((filters) => ({ ...filters, limit: event.pageSize, page: 1 }));
      this.loadTasks();
      return;
    }

    this.filters.update((filters) => ({ ...filters, page: event.pageIndex + 1 }));
    this.loadTasks();
  }

  reload(): void {
    this.loadTasks();
  }

  priorityLabel(priority: TaskPriority): string {
    return this.priorityLabels[priority];
  }

  statusLabel(status: TaskStatus): string {
    return this.statusLabels[status];
  }

  isOverdue(task: Task): boolean {
    return (
      task.status !== 'done' && Boolean(task.dueDate) && new Date(task.dueDate as string) < new Date()
    );
  }

  openTask(task: Task): void {
    void this.router.navigate(['/projects', task.projectId, 'tasks'], {
      queryParams: { task: task.id },
    });
  }

  openProjectBoard(task: Task, event: Event): void {
    event.stopPropagation();
    void this.router.navigate(['/projects', task.projectId, 'tasks']);
  }

  private setFilters(patch: Partial<GlobalTaskListQuery>): void {
    this.filters.update((filters) => ({ ...filters, ...patch }));
    this.loadTasks();
  }

  private loadProjects(): void {
    const query: ProjectListQuery = {
      search: '',
      page: 1,
      limit: 200,
      sortBy: 'title',
      sortOrder: 'asc',
    };

    this.projectService.list(query).subscribe({
      next: (result) => this.projects.set(result.data),
      error: () => this.projects.set([]),
    });
  }

  private loadTasks(): void {
    this.loading.set(true);
    this.error.set(null);

    this.taskService.listAll(this.filters()).subscribe({
      next: (result) => {
        this.tasks.set(result.data);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to load tasks.'));
        this.tasks.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }
}
