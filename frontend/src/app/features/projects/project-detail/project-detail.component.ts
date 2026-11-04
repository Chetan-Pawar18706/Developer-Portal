import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { distinctUntilChanged, filter, map } from 'rxjs';
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  type Project,
} from '../../../core/models/project.model';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ProjectStore } from '../project.store';

interface DetailTab {
  label: string;
  path: string;
}

const DETAIL_TABS: readonly DetailTab[] = [
  { label: 'Overview', path: 'overview' },
  { label: 'Requirements', path: 'requirements' },
  { label: 'Tasks', path: 'tasks' },
  { label: 'Issues', path: 'issues' },
  { label: 'Files', path: 'files' },
  { label: 'Discussion', path: 'discussion' },
  { label: 'Activity', path: 'activity' },
  { label: 'Reports', path: 'reports' },
];

@Component({
  selector: 'app-project-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    DatePipe,
    CurrencyPipe,
    StatusBadgeComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.scss',
})
export class ProjectDetailComponent {
  readonly store = inject(ProjectStore);
  private readonly route = inject(ActivatedRoute);

  readonly projectId = signal('');
  readonly tabs = DETAIL_TABS;
  readonly statusLabels = PROJECT_STATUS_LABELS;
  readonly priorityLabels = PROJECT_PRIORITY_LABELS;

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        filter((id) => id.length > 0),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.projectId.set(id);
        this.store.clearSelected();
        this.store.loadOne(id);
      });
  }

  memberLabel(project: Project): string {
    return project.members.map((member) => member.user.name).join(', ');
  }
}
