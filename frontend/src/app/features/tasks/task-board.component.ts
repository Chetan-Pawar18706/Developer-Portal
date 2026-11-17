import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CdkDragDrop,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule, type MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime } from 'rxjs';
import type { Project } from '../../core/models/project.model';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_ICONS,
  TASK_STATUS_LABELS,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../../core/models/task.model';
import { AuthService } from '../../core/services/auth.service';
import { TaskService } from '../../core/services/task.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { getErrorMessage } from '../../shared/utils/http-error';
import { ProjectStore } from '../projects/project.store';
import { TaskDialogComponent, type TaskDialogData } from './task-dialog.component';
import { TaskStore } from './task.store';

type TaskView = 'board' | 'list' | 'calendar';

interface BoardColumn {
  readonly status: TaskStatus;
  readonly label: string;
  readonly icon: string;
}

interface CalendarCell {
  readonly date: Date;
  readonly key: string;
  readonly inMonth: boolean;
  readonly today: boolean;
  readonly tasks: readonly Task[];
}

const BOARD_COLUMNS: readonly BoardColumn[] = TASK_STATUSES.map((status) => ({
  status,
  label: TASK_STATUS_LABELS[status],
  icon: TASK_STATUS_ICONS[status],
}));

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function toDateKey(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

@Component({
  selector: 'app-task-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DragDropModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    UserAvatarComponent,
  ],
  templateUrl: './task-board.component.html',
  styleUrl: './task-board.component.scss',
})
export class TaskBoardComponent {
  readonly store = inject(TaskStore);
  readonly auth = inject(AuthService);
  readonly projectStore = inject(ProjectStore);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly statuses = TASK_STATUSES;
  readonly statusLabels = TASK_STATUS_LABELS;
  readonly priorityLabels = TASK_PRIORITY_LABELS;
  readonly priorities = TASK_PRIORITIES;
  readonly columns = BOARD_COLUMNS;
  readonly weekdays = WEEKDAYS;
  readonly tableColumns = ['title', 'assignee', 'status', 'priority', 'dueDate', 'hours'];
  readonly view = signal<TaskView>('board');
  readonly calendarMonth = signal(startOfMonth(new Date()));
  readonly busyTaskId = signal<string | null>(null);
  private loadedProjectId = '';
  private readonly pendingTaskId = signal<string | null>(null);
  private dragging = false;

  readonly project = computed<Project | null>(() => this.projectStore.selected());
  readonly canManage = computed(
    () => this.auth.role() === 'admin' || this.auth.role() === 'pm',
  );
  readonly hasActiveFilters = computed(() => {
    const filters = this.store.filters();
    return Boolean(
      filters.search ||
        filters.assignee ||
        filters.label ||
        filters.priority ||
        filters.status ||
        filters.dueFrom ||
        filters.dueTo,
    );
  });
  readonly visibleColumns = computed(() => {
    const status = this.store.filters().status;

    if (status) {
      return this.columns.filter((column) => column.status === status);
    }

    return this.columns;
  });
  readonly monthLabel = computed(() =>
    this.calendarMonth().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  );
  readonly calendarCells = computed<readonly CalendarCell[]>(() => {
    const month = this.calendarMonth();
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(1 - first.getDay());
    const todayKey = toDateKey(new Date());
    const tasksByDate = new Map<string, Task[]>();

    for (const task of this.store.entities()) {
      if (!task.dueDate) {
        continue;
      }

      const key = toDateKey(task.dueDate);
      const tasks = tasksByDate.get(key) ?? [];
      tasks.push(task);
      tasksByDate.set(key, tasks);
    }

    for (const tasks of tasksByDate.values()) {
      tasks.sort(
        (left, right) =>
          PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority] ||
          left.order - right.order,
      );
    }

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = toDateKey(date);

      return {
        date,
        key,
        inMonth: date.getMonth() === month.getMonth(),
        today: key === todayKey,
        tasks: tasksByDate.get(key) ?? [],
      };
    });
  });

  readonly sort = viewChild(MatSort);
  readonly dataSource = new MatTableDataSource<Task>([]);

  readonly filterForm = this.formBuilder.group({
    search: '',
    assignee: '',
    priority: this.formBuilder.control<TaskPriority | ''>(''),
    status: this.formBuilder.control<TaskStatus | ''>(''),
    label: '',
    dueFrom: '',
    dueTo: '',
  });

  constructor() {
    this.dataSource.sortingDataAccessor = (task, property) => {
      switch (property) {
        case 'title':
          return task.title.toLowerCase();
        case 'assignee':
          return task.assignee?.name.toLowerCase() ?? '~';
        case 'status':
          return task.status;
        case 'priority':
          return PRIORITY_ORDER[task.priority];
        case 'dueDate':
          return task.dueDate ? new Date(task.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        case 'hours':
          return task.loggedHours;
        default:
          return '';
      }
    };

    effect(() => {
      const project = this.projectStore.selected();

      if (!project || project.id === this.loadedProjectId) {
        return;
      }

      this.loadedProjectId = project.id;
      this.filterForm.reset(
        {
          search: '',
          assignee: '',
          priority: '',
          status: '',
          label: '',
          dueFrom: '',
          dueTo: '',
        },
        { emitEvent: false },
      );
      this.store.load(project.id).subscribe({ error: () => undefined });
    });

    effect(() => {
      const taskId = this.pendingTaskId();
      const project = this.project();

      if (!taskId || !project) {
        return;
      }

      this.pendingTaskId.set(null);
      this.openTaskById(taskId, project);
    });

    effect(() => {
      this.dataSource.data = [...this.store.entities()];
    });

    effect(() => {
      const sort = this.sort();

      if (sort) {
        this.dataSource.sort = sort;
      }
    });

    this.filterForm.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed())
      .subscribe((value) => {
        this.store.setFilters({
          search: value.search,
          assignee: value.assignee,
          priority: value.priority,
          status: value.status,
          label: value.label,
          dueFrom: value.dueFrom,
          dueTo: value.dueTo,
        });
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const taskId = params.get('task');

      if (taskId) {
        this.pendingTaskId.set(taskId);
      }
    });
  }

  setView(event: MatButtonToggleChange): void {
    const value = event.value;

    if (value === 'board' || value === 'list' || value === 'calendar') {
      this.view.set(value);
    }
  }

  clearFilters(): void {
    this.filterForm.reset(
      {
        search: '',
        assignee: '',
        priority: '',
        status: '',
        label: '',
        dueFrom: '',
        dueTo: '',
      },
      { emitEvent: false },
    );
    this.store.resetFilters();
  }

  openCreate(defaultDueDate?: Date | string): void {
    const project = this.project();

    if (!project || !this.canManage()) {
      return;
    }

    this.dialog
      .open<TaskDialogComponent, TaskDialogData, boolean>(TaskDialogComponent, {
        data: {
          project,
          projectId: project.id,
          task: null,
          defaultDueDate: defaultDueDate
            ? new Date(defaultDueDate).toISOString()
            : undefined,
        },
        width: '46rem',
        maxWidth: '96vw',
        maxHeight: '92vh',
        autoFocus: 'dialog',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.refresh();
        }
      });
  }

  private openTaskById(taskId: string, project: Project): void {
    this.taskService.get(taskId).subscribe({
      next: (task) => {
        if (task.projectId !== project.id) {
          return;
        }

        this.openTask(task);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { task: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      },
      error: () => undefined,
    });
  }

  openTask(task: Task): void {
    if (this.dragging) {
      return;
    }

    const project = this.project();

    if (!project) {
      return;
    }

    this.dialog
      .open<TaskDialogComponent, TaskDialogData, boolean>(TaskDialogComponent, {
        data: { project, projectId: project.id, task },
        width: '46rem',
        maxWidth: '96vw',
        maxHeight: '92vh',
        autoFocus: 'dialog',
        restoreFocus: true,
      })
      .afterClosed()
      .subscribe((changed) => {
        if (changed) {
          this.refresh();
        }
      });
  }

  canDragTask(task: Task): boolean {
    const role = this.auth.role();
    const currentUser = this.auth.currentUser();

    if (role === 'admin' || role === 'pm') {
      return true;
    }

    return role === 'developer' && task.assignee?.id === currentUser?.id;
  }

  onDragStarted(): void {
    this.dragging = true;
  }

  onDragEnded(): void {
    window.setTimeout(() => {
      this.dragging = false;
    }, 0);
  }

  onDrop(event: CdkDragDrop<readonly Task[]>, status: TaskStatus): void {
    const task = event.item.data as Task | undefined;

    if (!task || !this.canDragTask(task)) {
      return;
    }

    if (task.status === status && event.previousIndex === event.currentIndex) {
      return;
    }

    this.busyTaskId.set(task.id);
    this.store.move(task.id, { status, order: event.currentIndex }).subscribe({
      next: () => this.busyTaskId.set(null),
      error: (error: unknown) => {
        this.busyTaskId.set(null);
        this.snackBar.open(getErrorMessage(error, 'Unable to move the task'), 'Dismiss', {
          duration: 3500,
          panelClass: 'app-snackbar-error',
        });
      },
    });
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'done') {
      return false;
    }

    return new Date(task.dueDate).getTime() < startOfDay(new Date()).getTime();
  }

  doneSubtaskCount(task: Task): number {
    return task.subtasks.filter((subtask) => subtask.done).length;
  }

  statusLabel(status: TaskStatus): string {
    return TASK_STATUS_LABELS[status];
  }

  priorityLabel(priority: TaskPriority): string {
    return TASK_PRIORITY_LABELS[priority];
  }

  isDueToday(task: Task): boolean {
    if (!task.dueDate) {
      return false;
    }

    return toDateKey(task.dueDate) === toDateKey(new Date());
  }

  shiftMonth(offset: number): void {
    const month = this.calendarMonth();
    this.calendarMonth.set(new Date(month.getFullYear(), month.getMonth() + offset, 1));
  }

  goToToday(): void {
    this.calendarMonth.set(startOfMonth(new Date()));
  }

  onDayClick(cell: CalendarCell): void {
    if (!this.canManage()) {
      return;
    }

    this.openCreate(cell.date);
  }

  openTaskFromCalendar(event: Event, task: Task): void {
    event.stopPropagation();
    this.openTask(task);
  }

  retry(): void {
    if (this.store.projectId()) {
      this.store.refresh().subscribe({ error: () => undefined });
    } else {
      const project = this.project();

      if (project) {
        this.store.load(project.id).subscribe({ error: () => undefined });
      }
    }
  }

  private refresh(): void {
    if (this.store.projectId()) {
      this.store.refresh().subscribe({ error: () => undefined });
    }
  }
}
