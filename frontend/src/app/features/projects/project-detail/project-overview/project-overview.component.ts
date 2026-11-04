import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  PROJECT_HEALTH_LABELS,
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectStatus,
  type SignOffInput,
  type UpdateProjectStatusRequest,
} from '../../../../core/models/project.model';
import { ROLE_LABELS, type Role } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { HasRoleDirective } from '../../../../shared/directives/has-role.directive';
import { ConfirmDialogService } from '../../../../shared/services/confirm-dialog.service';
import { ProjectStore } from '../../project.store';
import { AddMemberDialogComponent } from '../add-member-dialog.component';
import { SignOffDialogComponent } from '../sign-off-dialog.component';

interface StatusAction {
  label: string;
  status: ProjectStatus;
  icon: string;
  requiresSignOff?: boolean;
}

function buildStatusActions(
  project: Project | null,
  role: Role | null,
  userId: string,
): StatusAction[] {
  if (!project || !role) {
    return [];
  }

  const isOwner = role === 'client' && project.client.id === userId;
  const isLeadership = role === 'admin' || role === 'pm';

  if (isOwner && project.status === 'draft') {
    return [{ label: 'Submit for review', status: 'submitted', icon: 'send' }];
  }

  if (isOwner && project.status === 'active') {
    return [
      {
        label: 'Sign off & complete',
        status: 'completed',
        icon: 'verified',
        requiresSignOff: true,
      },
    ];
  }

  if (!isLeadership) {
    return [];
  }

  switch (project.status) {
    case 'submitted':
      return [
        { label: 'Start review', status: 'in_review', icon: 'rate_review' },
        { label: 'Activate', status: 'active', icon: 'rocket_launch' },
      ];
    case 'in_review':
      return [{ label: 'Activate', status: 'active', icon: 'rocket_launch' }];
    case 'active':
      return [{ label: 'Put on hold', status: 'on_hold', icon: 'pause_circle' }];
    case 'on_hold':
      return [{ label: 'Resume work', status: 'active', icon: 'play_circle' }];
    case 'completed':
      return [{ label: 'Archive project', status: 'archived', icon: 'archive' }];
    default:
      return [];
  }
}

@Component({
  selector: 'app-project-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    DatePipe,
    CurrencyPipe,
    StatusBadgeComponent,
    UserAvatarComponent,
    EmptyStateComponent,
    HasRoleDirective,
  ],
  templateUrl: './project-overview.component.html',
  styleUrl: './project-overview.component.scss',
})
export class ProjectOverviewComponent {
  readonly store = inject(ProjectStore);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);

  readonly statusLabels = PROJECT_STATUS_LABELS;
  readonly priorityLabels = PROJECT_PRIORITY_LABELS;
  readonly healthLabels = PROJECT_HEALTH_LABELS;
  readonly roleLabels = ROLE_LABELS;

  readonly canManageMembers = computed(() => {
    const role = this.auth.role();
    return role === 'admin' || role === 'pm';
  });

  readonly actions = computed(() =>
    buildStatusActions(
      this.store.selected(),
      this.auth.role(),
      this.auth.currentUser()?.id ?? '',
    ),
  );

  readonly ratingStars = [1, 2, 3, 4, 5] as const;

  runAction(action: StatusAction): void {
    const project = this.store.selected();

    if (!project) {
      return;
    }

    if (action.requiresSignOff) {
      this.dialog
        .open<SignOffDialogComponent, void, SignOffInput>(SignOffDialogComponent, {
          width: '28rem',
          maxWidth: '92vw',
        })
        .afterClosed()
        .subscribe((signOff) => {
          if (!signOff) {
            return;
          }

          this.updateStatus(project.id, {
            status: 'completed',
            note: signOff.note || undefined,
            rating: signOff.rating ?? undefined,
            feedback: signOff.feedback || undefined,
          });
        });

      return;
    }

    if (action.status === 'archived') {
      this.confirmDialog
        .confirm({
          title: 'Archive project',
          message: `Archive "${project.title}"? It will leave the active portfolio but stay available for reporting.`,
          confirmLabel: 'Archive',
          tone: 'warn',
        })
        .subscribe((confirmed) => {
          if (confirmed) {
            this.updateStatus(project.id, { status: 'archived' });
          }
        });

      return;
    }

    this.updateStatus(project.id, { status: action.status });
  }

  addMember(): void {
    const project = this.store.selected();

    if (!project) {
      return;
    }

    this.dialog
      .open<
        AddMemberDialogComponent,
        { existingUserIds: string[] },
        { userId: string; role: Role }
      >(AddMemberDialogComponent, {
        width: '28rem',
        maxWidth: '92vw',
        data: { existingUserIds: project.members.map((member) => member.user.id) },
      })
      .afterClosed()
      .subscribe((member) => {
        if (!member) {
          return;
        }

        this.store.addMember(project.id, member).subscribe({
          next: () => this.snackBar.open('Team member added', 'Dismiss', { duration: 3000 }),
        });
      });
  }

  removeMember(project: Project, userId: string, name: string): void {
    this.confirmDialog
      .confirm({
        title: 'Remove member',
        message: `Remove ${name} from this project? They will lose access to its workspace.`,
        confirmLabel: 'Remove',
        tone: 'warn',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.store.removeMember(project.id, userId).subscribe({
          next: () => this.snackBar.open('Team member removed', 'Dismiss', { duration: 3000 }),
        });
      });
  }

  private updateStatus(projectId: string, input: UpdateProjectStatusRequest): void {
    this.store.changeStatus(projectId, input).subscribe({
      next: () => this.snackBar.open('Project status updated', 'Dismiss', { duration: 3000 }),
    });
  }
}
