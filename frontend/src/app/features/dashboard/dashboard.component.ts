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
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import type { Observable } from 'rxjs';
import type { AdminDashboard, MeDashboard } from '../../core/models/dashboard.model';
import type { DashboardProjectRow } from '../../core/models/dashboard.model';
import { ROLE_LABELS } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { StatusDonutComponent } from '../../shared/charts/charts.component';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';
import { getErrorMessage } from '../../shared/utils/http-error';

type DashboardSummary = AdminDashboard | MeDashboard;

interface KpiCard {
  label: string;
  value: number;
  icon: string;
  hint: string;
  tone: 'primary' | 'success' | 'warning' | 'danger';
}

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    EmptyStateComponent,
    UserAvatarComponent,
    StatusDonutComponent,
    HasRoleDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.currentUser;
  readonly role = this.auth.role;
  readonly firstName = computed(() => this.user()?.name.trim().split(/\s+/)[0] ?? 'there');
  readonly roleLabel = computed(() => {
    const role = this.role();
    return role ? ROLE_LABELS[role] : 'Guest';
  });

  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly isAdminSummary = computed(() => {
    const summary = this.summary();
    return summary !== null && 'totals' in summary;
  });

  readonly projects = computed<readonly DashboardProjectRow[]>(() => this.summary()?.projects ?? []);

  readonly kpis = computed<readonly KpiCard[]>(() => {
    const summary = this.summary();

    if (!summary) {
      return [];
    }

    if ('totals' in summary) {
      return [
        { label: 'Projects', value: summary.totals.projects, icon: 'folder_open', hint: 'Portfolio size', tone: 'primary' },
        { label: 'Open tasks', value: summary.totals.tasks, icon: 'task_alt', hint: 'Tracked tasks', tone: 'success' },
        { label: 'Open issues', value: summary.totals.issues, icon: 'bug_report', hint: 'Across projects', tone: 'warning' },
        { label: 'Active users', value: summary.totals.activeUsers, icon: 'group', hint: 'Team members', tone: 'primary' },
      ];
    }

    return [
      { label: 'Projects', value: summary.metrics.visibleProjects, icon: 'folder_open', hint: 'You can access', tone: 'primary' },
      { label: 'Open tasks', value: summary.metrics.openTasks, icon: 'task_alt', hint: 'In progress work', tone: 'success' },
      { label: 'Overdue', value: summary.metrics.overdueTasks, icon: 'schedule', hint: 'Past due date', tone: 'danger' },
      { label: 'Approvals', value: summary.metrics.pendingApprovals, icon: 'pending_actions', hint: 'Waiting review', tone: 'warning' },
    ];
  });

  readonly donutLabels = computed(() => ['Completed', 'Open', 'Overdue']);
  readonly donutValues = computed(() => {
    const rows = this.projects();
    const done = rows.reduce((sum, row) => sum + row.doneTasks, 0);
    const overdue = rows.reduce((sum, row) => sum + row.overdueTasks, 0);
    const total = rows.reduce((sum, row) => sum + row.totalTasks, 0);
    return [done, Math.max(0, total - done - overdue), overdue];
  });

  readonly roleSubtitle = computed(() => {
    switch (this.role()) {
      case 'client':
        return 'Track delivery progress, approvals and issues across your projects.';
      case 'developer':
        return 'Focus on your assigned work and the deadlines ahead.';
      case 'pm':
        return 'Plan delivery, balance workload and keep projects healthy.';
      case 'admin':
        return 'Monitor platform activity, project health and team capacity.';
      default:
        return 'Your workspace overview.';
    }
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    const request: Observable<DashboardSummary> =
      this.role() === 'admin'
        ? this.dashboardService.getAdmin()
        : this.dashboardService.getMe();

    request
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(getErrorMessage(error, 'Unable to load your dashboard.'));
          this.summary.set(null);
          this.loading.set(false);
        },
      });
  }

  healthLabel(value: string): string {
    if (value === 'off_track') {
      return 'Delayed';
    }

    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
}
