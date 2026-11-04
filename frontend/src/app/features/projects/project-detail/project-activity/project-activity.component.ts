import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs';
import {
  PROJECT_STATUS_LABELS,
  type ProjectActivity,
  type ProjectStatus,
} from '../../../../core/models/project.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/components/loading-skeleton/loading-skeleton.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';
import { ProjectStore } from '../../project.store';

@Component({
  selector: 'app-project-activity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    UserAvatarComponent,
    TimeAgoPipe,
  ],
  template: `
    @if (store.activityLoading() && store.activity().length === 0) {
      <app-loading-skeleton [rows]="5" />
    } @else if (store.activity().length === 0) {
      <mat-card appearance="outlined">
        <app-empty-state
          icon="history"
          title="No activity yet"
          message="Status changes, member updates and delivery sign-offs will appear here."
        />
      </mat-card>
    } @else {
      @if (store.activityLoading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      <mat-card appearance="outlined" class="timeline-card">
        <mat-card-content>
          <ol class="timeline">
            @for (item of store.activity(); track item.id) {
              <li>
                <div class="timeline-marker">
                  <app-user-avatar
                    [name]="item.actor?.name ?? 'System'"
                    [avatar]="item.actor?.avatar ?? null"
                    size="sm"
                  />
                </div>

                <div class="timeline-body">
                  <p>
                    <strong>{{ item.actor?.name ?? 'System' }}</strong>
                    {{ describe(item) }}
                  </p>
                  <time>{{ item.createdAt | timeAgo }}</time>
                </div>
              </li>
            }
          </ol>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    .timeline-card {
      border-radius: 0.9rem;
    }

    .timeline {
      position: relative;
      margin: 0;
      padding: 0;
      list-style: none;

      &::before {
        position: absolute;
        top: 1rem;
        bottom: 1rem;
        left: 1rem;
        width: 1px;
        background: var(--mat-sys-outline-variant);
        content: '';
      }

      li {
        position: relative;
        display: flex;
        gap: 0.85rem;
        padding: 0.65rem 0;
      }
    }

    .timeline-marker {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      background: var(--mat-sys-surface);
      flex-shrink: 0;
    }

    .timeline-body {
      min-width: 0;
      padding-top: 0.15rem;

      p {
        margin: 0;
        line-height: 1.5;
      }

      strong {
        font-weight: 600;
      }

      time {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.78rem;
      }
    }

    mat-progress-bar {
      margin-bottom: 0.75rem;
    }
  `,
})
export class ProjectActivityComponent implements OnInit {
  readonly store = inject(ProjectStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.route.parent?.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        filter((id) => id.length > 0),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((projectId) => this.store.loadActivity(projectId));
  }

  describe(activity: ProjectActivity): string {
    switch (activity.action) {
      case 'project_created':
        return 'created the project';
      case 'project_updated':
        return 'updated the project details';
      case 'project_archived':
        return 'archived the project';
      case 'member_added':
        return 'added a team member';
      case 'member_removed':
        return 'removed a team member';
      case 'status_changed': {
        const from = this.statusLabel(activity.meta['from']);
        const to = this.statusLabel(activity.meta['to']);
        const signedOff = activity.meta['signedOff'] === true;

        if (signedOff) {
          return 'signed off delivery and completed the project';
        }

        return `moved the project from ${from} to ${to}`;
      }
      default:
        return 'updated the project';
    }
  }

  private statusLabel(value: unknown): string {
    if (typeof value === 'string' && value in PROJECT_STATUS_LABELS) {
      return PROJECT_STATUS_LABELS[value as ProjectStatus];
    }

    return 'another status';
  }
}
