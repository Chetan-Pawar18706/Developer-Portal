import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_STEPPER_STATUSES,
  REQUIREMENT_TYPE_LABELS,
  type CreateChangeRequestRequest,
  type Requirement,
  type RequirementStatus,
} from '../../../core/models/requirement.model';
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type RequirementTaskProgress,
  type Task,
} from '../../../core/models/task.model';
import { AuthService } from '../../../core/services/auth.service';
import { TaskService } from '../../../core/services/task.service';
import { CommentThreadComponent } from '../../communication/comment-thread.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { getErrorMessage } from '../../../shared/utils/http-error';
import { ProjectStore } from '../../projects/project.store';
import { TaskDialogComponent, type TaskDialogData } from '../../tasks/task-dialog.component';
import {
  ChangeRequestDialogComponent,
  type ChangeRequestDialogData,
} from '../change-request-dialog.component';
import {
  RequirementReviewDialogComponent,
  type RequirementReviewDialogData,
} from '../requirement-review-dialog.component';
import { RequirementStore } from '../requirement.store';

type StepState = 'complete' | 'current' | 'upcoming' | 'warning' | 'error';

interface DetailAction {
  label: string;
  icon: string;
  target: RequirementStatus;
  requiresNote?: boolean;
  tone?: 'primary' | 'warn';
}

function buildActions(
  requirement: Requirement | null,
  role: string | null,
  isClientOwner: boolean,
): DetailAction[] {
  if (!requirement || !role) {
    return [];
  }

  const isOwner = role === 'client' && isClientOwner;
  const isPm = role === 'pm';
  const isAdmin = role === 'admin';

  switch (requirement.status) {
    case 'draft':
      return isOwner || isAdmin
        ? [{ label: 'Submit for review', icon: 'send', target: 'submitted' }]
        : [];
    case 'submitted':
      return isPm || isAdmin
        ? [{ label: 'Start review', icon: 'rate_review', target: 'under_review' }]
        : [];
    case 'under_review': {
      const actions: DetailAction[] = [];

      if (isOwner || isPm || isAdmin) {
        actions.push({ label: 'Approve requirement', icon: 'verified', target: 'approved' });
      }

      if (isPm || isAdmin) {
        actions.push({
          label: 'Request clarification',
          icon: 'help',
          target: 'clarification',
          requiresNote: true,
        });
        actions.push({
          label: 'Reject requirement',
          icon: 'block',
          target: 'rejected',
          requiresNote: true,
          tone: 'warn',
        });
      }

      return actions;
    }
    case 'clarification':
      return isOwner || isAdmin
        ? [{ label: 'Resubmit for review', icon: 'send', target: 'submitted' }]
        : [];
    default:
      return [];
  }
}

@Component({
  selector: 'app-requirement-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatSidenavModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    StatusBadgeComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    UserAvatarComponent,
    CommentThreadComponent,
  ],
  templateUrl: './requirement-detail.component.html',
  styleUrl: './requirement-detail.component.scss',
})
export class RequirementDetailComponent {
  readonly store = inject(RequirementStore);
  readonly projectStore = inject(ProjectStore);
  readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly taskService = inject(TaskService);

  readonly projectId = signal('');
  readonly requirementId = signal('');
  readonly drawerOpen = signal(false);
  readonly acting = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly taskProgress = signal<RequirementTaskProgress | null>(null);
  readonly progressLoading = signal(false);

  readonly stepper = REQUIREMENT_STEPPER_STATUSES;
  readonly statusLabels = REQUIREMENT_STATUS_LABELS;
  readonly priorityLabels = REQUIREMENT_PRIORITY_LABELS;
  readonly typeLabels = REQUIREMENT_TYPE_LABELS;
  readonly taskStatuses = TASK_STATUSES;
  readonly taskStatusLabels = TASK_STATUS_LABELS;

  readonly isClientOwner = computed(() => {
    const project = this.projectStore.selected();
    const user = this.auth.currentUser();
    return Boolean(project && user && project.client.id === user.id);
  });

  readonly canEdit = computed(() => {
    const requirement = this.store.selected();
    const role = this.auth.role();

    if (!requirement || requirement.status === 'approved' || !role) {
      return false;
    }

    return role === 'admin' || role === 'pm' || (role === 'client' && this.isClientOwner());
  });

  readonly canRaiseChangeRequest = computed(() => {
    const requirement = this.store.selected();
    const role = this.auth.role();

    return Boolean(
      requirement &&
      requirement.status === 'approved' &&
      (role === 'admin' || role === 'pm' || (role === 'client' && this.isClientOwner())),
    );
  });

  readonly actions = computed(() =>
    buildActions(this.store.selected(), this.auth.role(), this.isClientOwner()),
  );

  readonly versions = computed(() => [...(this.store.selected()?.versions ?? [])].reverse());

  readonly activeStep = computed(() => {
    const status = this.store.selected()?.status;

    switch (status) {
      case 'submitted':
        return 1;
      case 'under_review':
      case 'clarification':
      case 'rejected':
        return 2;
      case 'approved':
        return 3;
      default:
        return 0;
    }
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => {
      const projectId =
        this.route.snapshot.pathFromRoot
          .map((snapshot) => snapshot.paramMap.get('id'))
          .find((value): value is string => Boolean(value)) ?? '';
      const requirementId = this.route.snapshot.paramMap.get('requirementId') ?? '';

      this.projectId.set(projectId);
      this.requirementId.set(requirementId);
      this.store.clearSelected();
      this.actionError.set(null);
      this.drawerOpen.set(false);
      this.taskProgress.set(null);

      if (requirementId) {
        this.store.loadOne(requirementId);
        this.loadTaskProgress(requirementId);
      }
    });
  }

  loadTaskProgress(requirementId: string): void {
    this.progressLoading.set(true);

    this.taskService.getRequirementProgress(requirementId).subscribe({
      next: (progress) => {
        this.taskProgress.set(progress);
        this.progressLoading.set(false);
      },
      error: () => {
        this.taskProgress.set(null);
        this.progressLoading.set(false);
      },
    });
  }

  openTask(task: Task): void {
    const project = this.projectStore.selected();

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
          this.loadTaskProgress(this.requirementId());
        }
      });
  }

  stepState(index: number): StepState {
    const status = this.store.selected()?.status;
    const active = this.activeStep();

    if (index === active) {
      if (status === 'clarification') {
        return 'warning';
      }

      if (status === 'rejected') {
        return 'error';
      }

      return 'current';
    }

    return index < active ? 'complete' : 'upcoming';
  }

  runAction(action: DetailAction): void {
    if (action.requiresNote) {
      const data: RequirementReviewDialogData = {
        title: action.label,
        message:
          action.target === 'clarification'
            ? 'Tell the client exactly what is missing or unclear. They will be able to edit and resubmit the requirement.'
            : 'Explain why this requirement is being rejected. The note is kept in the requirement history.',
        confirmLabel: action.label,
        placeholder:
          action.target === 'clarification'
            ? 'Which part needs more detail?'
            : 'Why is this requirement out of scope?',
      };

      this.dialog
        .open<RequirementReviewDialogComponent, RequirementReviewDialogData, string>(
          RequirementReviewDialogComponent,
          { data, width: '34rem', maxWidth: '92vw' },
        )
        .afterClosed()
        .subscribe((note) => {
          if (note) {
            this.changeStatus(action.target, note);
          }
        });
      return;
    }

    this.changeStatus(action.target);
  }

  openChangeRequest(): void {
    const requirement = this.store.selected();

    if (!requirement) {
      return;
    }

    const data: ChangeRequestDialogData = { requirement };

    this.dialog
      .open<ChangeRequestDialogComponent, ChangeRequestDialogData, CreateChangeRequestRequest>(
        ChangeRequestDialogComponent,
        {
          data,
          width: '38rem',
          maxWidth: '94vw',
        },
      )
      .afterClosed()
      .subscribe((request) => {
        if (!request) {
          return;
        }

        this.acting.set(true);
        this.actionError.set(null);

        this.store.createChangeRequest(requirement.id, request).subscribe({
          next: (changeRequest) => {
            this.acting.set(false);
            this.snackBar.open('Change request created', 'Dismiss', { duration: 3000 });
            this.router.navigate([
              '/projects',
              changeRequest.projectId,
              'requirements',
              changeRequest.id,
            ]);
          },
          error: (error: unknown) => {
            this.acting.set(false);
            this.actionError.set(getErrorMessage(error, 'Unable to create the change request.'));
          },
        });
      });
  }

  private changeStatus(status: RequirementStatus, note?: string): void {
    const requirement = this.store.selected();

    if (!requirement) {
      return;
    }

    this.acting.set(true);
    this.actionError.set(null);

    this.store.changeStatus(requirement.id, { status, note }).subscribe({
      next: () => {
        this.acting.set(false);
        this.snackBar.open('Requirement status updated', 'Dismiss', { duration: 3000 });
      },
      error: (error: unknown) => {
        this.acting.set(false);
        this.actionError.set(getErrorMessage(error, 'Unable to update the requirement.'));
      },
    });
  }
}
