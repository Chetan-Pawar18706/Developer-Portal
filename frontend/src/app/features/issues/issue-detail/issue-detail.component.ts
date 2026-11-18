import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ISSUE_SEVERITY_LABELS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  type Issue,
  type IssueSeverity,
  type IssueStatus,
} from '../../../core/models/issue.model';
import { AuthService } from '../../../core/services/auth.service';
import { CommentThreadComponent } from '../../communication/comment-thread.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { getErrorMessage } from '../../../shared/utils/http-error';
import { ProjectStore } from '../../projects/project.store';
import { IssueStore } from '../issue.store';

@Component({
  selector: 'app-issue-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    StatusBadgeComponent,
    UserAvatarComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    CommentThreadComponent,
  ],
  templateUrl: './issue-detail.component.html',
  styleUrl: './issue-detail.component.scss',
})
export class IssueDetailComponent {
  readonly store = inject(IssueStore);
  readonly projectStore = inject(ProjectStore);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly projectId = signal('');
  readonly issueId = signal('');
  readonly acting = signal(false);
  readonly actionError = signal<string | null>(null);

  readonly statusControl = new FormControl<IssueStatus>('open', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly assigneeControl = new FormControl('', { nonNullable: true });

  readonly statuses = ISSUE_STATUSES;
  readonly statusLabels = ISSUE_STATUS_LABELS;
  readonly typeLabels = ISSUE_TYPE_LABELS;
  readonly severityLabels = ISSUE_SEVERITY_LABELS;

  readonly isClientOwner = computed(() => {
    const project = this.projectStore.selected();
    const user = this.auth.currentUser();
    return Boolean(project && user && project.client.id === user.id);
  });

  readonly canManage = computed(() => {
    const role = this.auth.role();
    return role === 'admin' || role === 'pm';
  });

  readonly canConvert = computed(
    () => this.canManage() && !this.store.selected()?.linkedTask,
  );

  readonly statusOptions = computed<readonly IssueStatus[]>(() => {
    if (this.auth.role() !== 'client') {
      return ISSUE_STATUSES;
    }

    if (!this.isClientOwner()) {
      return [];
    }

    return ISSUE_STATUSES.filter((status) => status === 'closed' || status === 'reopened');
  });

  readonly assigneeOptions = computed(() =>
    (this.projectStore.selected()?.members ?? []).filter(
      (member) => member.user.role !== 'client',
    ),
  );

  readonly daysOpen = computed(() => {
    const issue = this.store.selected();

    if (!issue) {
      return 0;
    }

    const end = issue.status === 'closed' ? new Date(issue.updatedAt) : new Date();
    return Math.max(0, Math.floor((end.getTime() - new Date(issue.createdAt).getTime()) / 86_400_000));
  });

  readonly ageTone = computed(() => {
    const days = this.daysOpen();

    if (this.store.selected()?.status === 'closed') {
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
  });

  readonly ageLabel = computed(() => {
    const days = this.daysOpen();
    const noun = days === 1 ? 'day' : 'days';
    return this.store.selected()?.status === 'closed'
      ? `Closed after ${days} ${noun}`
      : `Open for ${days} ${noun}`;
  });

  constructor() {
    effect(() => {
      const issue = this.store.selected();

      if (!issue) {
        return;
      }

      this.statusControl.setValue(issue.status, { emitEvent: false });
      this.assigneeControl.setValue(issue.assignedTo?.id ?? '', { emitEvent: false });
    });

    this.statusControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((status) => {
      const issue = this.store.selected();

      if (!issue || status === issue.status) {
        return;
      }

      this.acting.set(true);
      this.actionError.set(null);

      this.store.changeStatus(issue.id, { status }).subscribe({
        next: () => {
          this.acting.set(false);
          this.snackBar.open(`Issue marked ${this.statusLabels[status].toLowerCase()}`, 'Dismiss', {
            duration: 2500,
          });
        },
        error: (error: unknown) => {
          this.acting.set(false);
          this.actionError.set(getErrorMessage(error, 'Unable to change the issue status.'));
          this.statusControl.setValue(issue.status, { emitEvent: false });
        },
      });
    });

    this.assigneeControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((assigneeId) => {
      const issue = this.store.selected();

      if (!issue || assigneeId === (issue.assignedTo?.id ?? '')) {
        return;
      }

      this.acting.set(true);
      this.actionError.set(null);

      this.store.assign(issue.id, assigneeId || null).subscribe({
        next: () => {
          this.acting.set(false);
          this.snackBar.open('Assignee updated', 'Dismiss', { duration: 2500 });
        },
        error: (error: unknown) => {
          this.acting.set(false);
          this.actionError.set(getErrorMessage(error, 'Unable to update the assignee.'));
          this.assigneeControl.setValue(issue.assignedTo?.id ?? '', { emitEvent: false });
        },
      });
    });

    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => {
      const projectId =
        this.route.snapshot.pathFromRoot
          .map((snapshot) => snapshot.paramMap.get('id'))
          .find((value): value is string => Boolean(value)) ?? '';
      const issueId = this.route.snapshot.paramMap.get('issueId') ?? '';

      this.projectId.set(projectId);
      this.issueId.set(issueId);
      this.store.clearSelected();
      this.actionError.set(null);

      if (issueId) {
        this.store.loadOne(issueId);
      }
    });
  }

  severityLabel(severity: IssueSeverity): string {
    return this.severityLabels[severity];
  }

  convertToTask(): void {
    const issue = this.store.selected();

    if (!issue || !this.canConvert()) {
      return;
    }

    this.acting.set(true);
    this.actionError.set(null);

    this.store.convertToTask(issue.id).subscribe({
      next: (task) => {
        this.acting.set(false);
        this.snackBar.open('Issue converted to task', 'Dismiss', { duration: 2500 });
        this.store.loadOne(issue.id);
        this.router.navigate(['/projects', this.projectId(), 'tasks'], {
          queryParams: { task: task.id },
        });
      },
      error: (error: unknown) => {
        this.acting.set(false);
        this.actionError.set(getErrorMessage(error, 'Unable to convert this issue.'));
      },
    });
  }

  openLinkedTask(issue: Issue): void {
    if (!issue.linkedTask) {
      return;
    }

    this.router.navigate(['/projects', this.projectId(), 'tasks'], {
      queryParams: { task: issue.linkedTask.id },
    });
  }
}
