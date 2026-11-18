import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import type { Project } from '../../core/models/project.model';
import type { Requirement } from '../../core/models/requirement.model';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_CLIENT_REVIEW_LABELS,
  type AddTimeLogRequest,
  type CreateTaskRequest,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type TaskSubtask,
  type UpdateTaskRequest,
} from '../../core/models/task.model';
import { AuthService } from '../../core/services/auth.service';
import { RequirementService } from '../../core/services/requirement.service';
import { getErrorMessage } from '../../shared/utils/http-error';
import { CommentThreadComponent } from '../communication/comment-thread.component';
import { ConfirmDialogService } from '../../shared/services/confirm-dialog.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { TaskStore } from './task.store';
import {
  TaskReviewDialogComponent,
  type TaskReviewDialogData,
} from './task-review-dialog.component';

export interface TaskDialogData {
  project: Project;
  projectId: string;
  task: Task | null;
  defaultDueDate?: string;
}

@Component({
  selector: 'app-task-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    StatusBadgeComponent,
    UserAvatarComponent,
    CommentThreadComponent,
  ],
  templateUrl: './task-dialog.component.html',
  styleUrl: './task-dialog.component.scss',
})
export class TaskDialogComponent implements OnInit {
  readonly data = inject<TaskDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TaskDialogComponent, boolean>);
  private readonly dialog = inject(MatDialog);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly taskStore = inject(TaskStore);
  private readonly auth = inject(AuthService);
  private readonly requirementService = inject(RequirementService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);

  readonly statuses = TASK_STATUSES;
  readonly statusLabels = TASK_STATUS_LABELS;
  readonly clientReviewLabels = TASK_CLIENT_REVIEW_LABELS;
  readonly priorities = TASK_PRIORITIES;
  readonly priorityLabels = TASK_PRIORITY_LABELS;

  readonly task = signal<Task | null>(this.data.task);
  readonly requirements = signal<readonly Requirement[]>([]);
  readonly requirementsLoading = signal(false);
  readonly subtasks = signal<TaskSubtask[]>(this.data.task?.subtasks ?? []);
  readonly newSubtask = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly isCreate = computed(() => this.data.task === null);
  readonly isNew = computed(() => this.task() === null);
  readonly canEdit = computed(() => {
    const role = this.auth.role();
    const currentUser = this.auth.currentUser();
    const task = this.task();

    if (role === 'admin' || role === 'pm') {
      return true;
    }

    return Boolean(
      role === 'developer' &&
        currentUser &&
        task?.assignee?.id === currentUser.id,
    );
  });
  readonly canManage = computed(() => this.auth.role() === 'admin' || this.auth.role() === 'pm');
  readonly canDelete = computed(() => !this.isNew() && this.canManage());
  readonly canReview = computed(
    () => this.auth.role() === 'client' && this.task()?.status === 'in_review',
  );
  readonly loggedHours = computed(() =>
    (this.task()?.timeLogs ?? []).reduce((total, log) => total + log.hours, 0),
  );
  readonly loggedPercent = computed(() => {
    const estimate = this.task()?.estimateHours ?? 0;

    if (estimate <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((this.loggedHours() / estimate) * 100));
  });
  readonly completedSubtasks = computed(
    () => this.subtasks().filter((subtask) => subtask.done).length,
  );

  readonly form = this.formBuilder.group({
    title: this.formBuilder.control('', [
      Validators.required,
      Validators.minLength(3),
      Validators.maxLength(160),
    ]),
    description: this.formBuilder.control('', [Validators.maxLength(20_000)]),
    status: this.formBuilder.control<TaskStatus>('todo'),
    priority: this.formBuilder.control<TaskPriority>('medium'),
    assigneeId: this.formBuilder.control(''),
    requirementId: this.formBuilder.control(''),
    estimateHours: this.formBuilder.control(0, [Validators.min(0), Validators.max(10_000)]),
    dueDate: this.formBuilder.control(''),
    labels: this.formBuilder.control('', [Validators.maxLength(600)]),
  });

  readonly timeForm = this.formBuilder.group({
    hours: this.formBuilder.control(1, [Validators.min(0.25), Validators.max(24)]),
    note: this.formBuilder.control('', [Validators.maxLength(1000)]),
    date: this.formBuilder.control(this.toDateInput(new Date())),
  });

  ngOnInit(): void {
    const task = this.data.task;

    if (task) {
      this.form.patchValue({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assignee?.id ?? '',
        requirementId: task.requirement?.id ?? '',
        estimateHours: task.estimateHours,
        dueDate: task.dueDate ? this.toDateInput(task.dueDate) : '',
        labels: task.labels.join(', '),
      });
    } else if (this.data.defaultDueDate) {
      this.form.patchValue({ dueDate: this.toDateInput(this.data.defaultDueDate) });
    }

    if (!this.canEdit()) {
      this.form.disable();
    }

    this.loadRequirements();
  }

  save(): void {
    if (!this.canEdit() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const dueDate = value.dueDate ? new Date(`${value.dueDate}T00:00:00`).toISOString() : null;
    const labels = value.labels
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label.length > 0);
    const common = {
      title: value.title.trim(),
      description: value.description.trim(),
      priority: value.priority,
      estimateHours: Number(value.estimateHours) || 0,
      dueDate,
      labels,
    };

    this.saving.set(true);
    this.error.set(null);

    if (this.isNew()) {
      const payload: CreateTaskRequest = {
        ...common,
        assigneeId: value.assigneeId || null,
        requirementId: value.requirementId || null,
        subtasks: this.subtasks(),
      };

      this.taskStore.create(this.data.projectId, payload).subscribe({
        next: (task) => {
          this.saving.set(false);
          this.snackBar.open('Task created', 'Dismiss', { duration: 3000 });
          this.dialogRef.close(true);
          this.task.set(task);
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.error.set(getErrorMessage(error, 'Unable to create the task'));
        },
      });
      return;
    }

    const task = this.task();

    if (!task) {
      return;
    }

    const update: UpdateTaskRequest = {
      ...common,
      status: value.status,
    };

    if (this.canManage()) {
      update.assigneeId = value.assigneeId || null;
      update.requirementId = value.requirementId || null;
    }

    this.taskStore.update(task.id, update).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.task.set(updated);
        this.snackBar.open('Task updated', 'Dismiss', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(getErrorMessage(error, 'Unable to update the task'));
      },
    });
  }

  deleteTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.confirmDialog
      .confirm({
        title: 'Delete task?',
        message: `“${task.title}” will be permanently removed from this project.`,
        confirmLabel: 'Delete task',
        tone: 'warn',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.taskStore.remove(task.id).subscribe({
          next: () => {
            this.snackBar.open('Task deleted', 'Dismiss', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error: unknown) => {
            this.error.set(getErrorMessage(error, 'Unable to delete the task'));
          },
        });
      });
  }

  addSubtask(): void {
    const title = this.newSubtask().trim();

    if (!title || !this.canEdit()) {
      return;
    }

    const next = [...this.subtasks(), { title, done: false }];
    this.newSubtask.set('');
    this.persistSubtasks(next);
  }

  onSubtaskInput(event: Event): void {
    this.newSubtask.set((event.target as HTMLInputElement).value);
  }

  toggleSubtask(index: number): void {
    if (!this.canEdit()) {
      return;
    }

    const next = this.subtasks().map((subtask, subtaskIndex) =>
      subtaskIndex === index ? { ...subtask, done: !subtask.done } : subtask,
    );

    this.persistSubtasks(next);
  }

  removeSubtask(index: number): void {
    if (!this.canEdit()) {
      return;
    }

    this.persistSubtasks(this.subtasks().filter((_, subtaskIndex) => subtaskIndex !== index));
  }

  submitTimeLog(): void {
    const task = this.task();

    if (!task || !this.canEdit() || this.timeForm.invalid) {
      this.timeForm.markAllAsTouched();
      return;
    }

    const value = this.timeForm.getRawValue();
    const payload: AddTimeLogRequest = {
      hours: Number(value.hours),
      note: value.note.trim(),
      date: value.date ? new Date(`${value.date}T00:00:00`).toISOString() : undefined,
    };

    this.taskStore.addTimeLog(task.id, payload).subscribe({
      next: (updated) => {
        this.task.set(updated);
        this.timeForm.patchValue({ hours: 1, note: '' });
        this.snackBar.open('Time logged', 'Dismiss', { duration: 2500 });
      },
      error: (error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to save the time log'));
      },
    });
  }

  approveTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.taskStore.clientReview(task.id, { status: 'approved', note: '' }).subscribe({
      next: () => {
        this.snackBar.open('Task approved', 'Dismiss', { duration: 3000 });
        this.dialogRef.close(true);
      },
      error: (error: unknown) => {
        this.error.set(getErrorMessage(error, 'Unable to approve the task'));
      },
    });
  }

  requestChanges(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.dialog
      .open<TaskReviewDialogComponent, TaskReviewDialogData, string>(
        TaskReviewDialogComponent,
        {
          data: { taskTitle: task.title },
          width: '34rem',
          maxWidth: '92vw',
          autoFocus: 'dialog',
          restoreFocus: true,
        },
      )
      .afterClosed()
      .subscribe((note) => {
        if (!note) {
          return;
        }

        this.taskStore.clientReview(task.id, { status: 'changes_requested', note }).subscribe({
          next: () => {
            this.snackBar.open('Changes requested', 'Dismiss', { duration: 3000 });
            this.dialogRef.close(true);
          },
          error: (error: unknown) => {
            this.error.set(getErrorMessage(error, 'Unable to request changes'));
          },
        });
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  canShowAssignment(): boolean {
    return this.canManage();
  }

  private loadRequirements(): void {
    this.requirementsLoading.set(true);

    this.requirementService
      .list(this.data.projectId, {
        search: '',
        page: 1,
        limit: 200,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      })
      .subscribe({
        next: (result) => {
          this.requirements.set(result.data);
          this.requirementsLoading.set(false);
        },
        error: () => {
          this.requirementsLoading.set(false);
        },
      });
  }

  private persistSubtasks(subtasks: TaskSubtask[]): void {
    const previous = this.subtasks();
    this.subtasks.set(subtasks);

    const task = this.task();

    if (!task) {
      return;
    }

    this.taskStore.updateSubtasks(task.id, { subtasks }).subscribe({
      next: (updated) => {
        this.task.set(updated);
        this.subtasks.set(updated.subtasks);
      },
      error: (error: unknown) => {
        this.subtasks.set(previous);
        this.snackBar.open(getErrorMessage(error, 'Unable to update the checklist'), 'Dismiss', {
          duration: 3500,
        });
      },
    });
  }

  private toDateInput(value: string | Date): string {
    const date = typeof value === 'string' ? new Date(value) : value;
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
