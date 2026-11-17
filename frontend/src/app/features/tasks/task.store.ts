import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, tap, throwError } from 'rxjs';
import type {
  AddTimeLogRequest,
  ClientReviewRequest,
  CreateTaskRequest,
  MoveTaskRequest,
  Task,
  TaskFilters,
  TaskListQuery,
  TaskPriority,
  TaskStatus,
  UpdateSubtasksRequest,
  UpdateTaskRequest,
} from '../../core/models/task.model';
import { TASK_STATUSES } from '../../core/models/task.model';
import { TaskService } from '../../core/services/task.service';
import { getErrorMessage } from '../../shared/utils/http-error';

const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  assignee: '',
  label: '',
  priority: '',
  status: '',
  dueFrom: '',
  dueTo: '',
  page: 1,
  limit: 200,
  sortBy: 'order',
  sortOrder: 'asc',
};

function optimisticMove(
  tasks: readonly Task[],
  taskId: string,
  targetStatus: TaskStatus,
  targetOrder: number,
): readonly Task[] {
  const movedTask = tasks.find((task) => task.id === taskId);

  if (!movedTask) {
    return tasks;
  }

  const groups = new Map<TaskStatus, Task[]>();

  for (const status of TASK_STATUSES) {
    groups.set(status, []);
  }

  for (const task of tasks) {
    groups.get(task.status)?.push(task);
  }

  const sourceTasks = groups.get(movedTask.status);

  if (!sourceTasks) {
    return tasks;
  }

  const sourceIndex = sourceTasks.findIndex((task) => task.id === taskId);

  if (sourceIndex >= 0) {
    sourceTasks.splice(sourceIndex, 1);
  }

  const targetTasks = groups.get(targetStatus);

  if (!targetTasks) {
    return tasks;
  }

  const insertAt = Math.max(0, Math.min(targetOrder, targetTasks.length));
  targetTasks.splice(insertAt, 0, { ...movedTask, status: targetStatus });

  const next: Task[] = [];

  for (const status of TASK_STATUSES) {
    const statusTasks = groups.get(status) ?? [];

    statusTasks.forEach((task, index) => {
      next.push(
        task.order === index && task.status === status
          ? task
          : { ...task, order: index, status },
      );
    });
  }

  return next;
}

@Injectable({ providedIn: 'root' })
export class TaskStore {
  private readonly taskService = inject(TaskService);

  readonly entities = signal<readonly Task[]>([]);
  readonly selected = signal<Task | null>(null);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly projectId = signal('');
  readonly filters = signal<TaskFilters>({ ...DEFAULT_FILTERS });

  readonly grouped = computed<Record<TaskStatus, readonly Task[]>>(() => {
    const groups: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      in_review: [],
      blocked: [],
      done: [],
    };

    for (const task of this.entities()) {
      groups[task.status].push(task);
    }

    for (const status of TASK_STATUSES) {
      groups[status].sort(
        (left, right) =>
          left.order - right.order ||
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
    }

    return groups;
  });

  readonly counts = computed<Record<TaskStatus, number>>(() => {
    const groups = this.grouped();
    return {
      todo: groups.todo.length,
      in_progress: groups.in_progress.length,
      in_review: groups.in_review.length,
      blocked: groups.blocked.length,
      done: groups.done.length,
    };
  });

  load(projectId: string): Observable<{ data: Task[]; total: number; page: number; limit: number }> {
    const projectChanged = this.projectId() !== projectId;

    this.projectId.set(projectId);

    if (projectChanged) {
      this.filters.set({ ...DEFAULT_FILTERS });
    }

    this.loading.set(true);
    this.error.set(null);

    return this.taskService.list(projectId, this.buildQuery()).pipe(
      tap((result) => {
        this.entities.set(result.data);
        this.total.set(result.total);
      }),
      catchError((error: unknown) => {
        const message = getErrorMessage(error, 'Unable to load tasks');
        this.error.set(message);
        return throwError(() => error);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  refresh(): Observable<{ data: Task[]; total: number; page: number; limit: number }> {
    return this.load(this.projectId());
  }

  setFilters(patch: Partial<TaskFilters>): void {
    const next = {
      ...this.filters(),
      ...patch,
      page: patch.page ?? 1,
    };

    this.filters.set(next);

    if (this.projectId()) {
      this.load(this.projectId()).subscribe({ error: () => undefined });
    }
  }

  resetFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.setFilters({});
  }

  create(projectId: string, input: CreateTaskRequest): Observable<Task> {
    this.saving.set(true);
    this.error.set(null);

    return this.taskService.create(projectId, input).pipe(
      tap((task) => this.upsert(task)),
      catchError((error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to create the task'));
        return throwError(() => error);
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  update(taskId: string, input: UpdateTaskRequest): Observable<Task> {
    this.saving.set(true);
    this.error.set(null);

    return this.taskService.update(taskId, input).pipe(
      tap((task) => this.upsert(task)),
      catchError((error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to update the task'));
        return throwError(() => error);
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  move(taskId: string, input: MoveTaskRequest): Observable<Task> {
    const snapshot = this.entities();
    const selectedSnapshot = this.selected();

    this.entities.set(optimisticMove(snapshot, taskId, input.status, input.order));
    this.error.set(null);

    return this.taskService.move(taskId, input).pipe(
      tap((task) => this.upsert(task)),
      catchError((error: unknown) => {
        this.entities.set(snapshot);
        this.selected.set(selectedSnapshot);
        this.error.set(getErrorMessage(error, 'Unable to move the task'));
        return throwError(() => error);
      }),
    );
  }

  remove(taskId: string): Observable<void> {
    this.saving.set(true);
    this.error.set(null);

    return this.taskService.delete(taskId).pipe(
      tap(() => {
        this.entities.update((tasks) => tasks.filter((task) => task.id !== taskId));

        if (this.selected()?.id === taskId) {
          this.selected.set(null);
        }
      }),
      catchError((error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to delete the task'));
        return throwError(() => error);
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  addTimeLog(taskId: string, input: AddTimeLogRequest): Observable<Task> {
    this.saving.set(true);
    this.error.set(null);

    return this.taskService.addTimeLog(taskId, input).pipe(
      tap((task) => this.upsert(task)),
      catchError((error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to save the time log'));
        return throwError(() => error);
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  updateSubtasks(taskId: string, input: UpdateSubtasksRequest): Observable<Task> {
    this.saving.set(true);
    this.error.set(null);

    return this.taskService.updateSubtasks(taskId, input).pipe(
      tap((task) => this.upsert(task)),
      catchError((error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to update the checklist'));
        return throwError(() => error);
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  clientReview(taskId: string, input: ClientReviewRequest): Observable<Task> {
    this.saving.set(true);
    this.error.set(null);

    return this.taskService.clientReview(taskId, input).pipe(
      tap((task) => this.upsert(task)),
      catchError((error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to save the client review'));
        return throwError(() => error);
      }),
      finalize(() => this.saving.set(false)),
    );
  }

  private upsert(task: Task): void {
    this.entities.update((tasks) => {
      const index = tasks.findIndex((candidate) => candidate.id === task.id);

      if (index === -1) {
        return [...tasks, task];
      }

      const next = [...tasks];
      next[index] = task;
      return next;
    });

    if (this.selected()?.id === task.id) {
      this.selected.set(task);
    }
  }

  private buildQuery(): TaskListQuery {
    const filters = this.filters();
    const query: TaskListQuery = {
      search: filters.search.trim(),
      assignee: filters.assignee,
      label: filters.label.trim(),
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };

    if (filters.priority) {
      query.priority = filters.priority as TaskPriority;
    }

    if (filters.status) {
      query.status = filters.status as TaskStatus;
    }

    if (filters.dueFrom) {
      query.dueFrom = filters.dueFrom;
    }

    if (filters.dueTo) {
      query.dueTo = filters.dueTo;
    }

    return query;
  }
}
