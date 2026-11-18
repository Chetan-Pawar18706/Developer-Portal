import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { PmDashboard } from '../../core/models/dashboard.model';
import type { PortfolioReport } from '../../core/models/report.model';
import { DashboardService } from '../../core/services/dashboard.service';
import { ReportService } from '../../core/services/report.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import {
  BurnDownLineComponent,
  WorkloadBarComponent,
} from '../../shared/charts/charts.component';
import { getErrorMessage } from '../../shared/utils/http-error';

@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
    WorkloadBarComponent,
    BurnDownLineComponent,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly dashboardService = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly report = signal<PortfolioReport | null>(null);
  readonly pmDashboard = signal<PmDashboard | null>(null);
  readonly projectId = signal<string | undefined>(undefined);
  readonly downloading = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    const projectId = this.route.parent?.snapshot.paramMap.get('id') ?? undefined;
    this.projectId.set(projectId);
    this.load(projectId);
  }

  load(projectId?: string): void {
    this.loading.set(true);
    this.error.set('');

    if (projectId) {
      this.dashboardService
        .getProjectPm(projectId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (dashboard) => this.pmDashboard.set(dashboard),
          error: () => this.pmDashboard.set(null),
        });
    } else {
      this.pmDashboard.set(null);
    }

    this.reportService
      .get(projectId ? { projectId } : {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (report) => {
          this.report.set(report);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(getErrorMessage(error, 'Unable to generate the report.'));
          this.report.set(null);
          this.loading.set(false);
        },
      });
  }

  downloadPdf(): void {
    const projectId = this.projectId();

    if (!projectId || this.downloading()) {
      return;
    }

    this.downloading.set(true);
    this.dashboardService
      .downloadProjectReport(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ blob, fileName }) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          anchor.click();
          URL.revokeObjectURL(url);
          this.downloading.set(false);
        },
        error: () => this.downloading.set(false),
      });
  }

  label(value: string): string {
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  barWidth(count: number, counts: readonly { count: number }[]): number {
    const total = counts.reduce((sum, item) => sum + item.count, 0);
    return total === 0 ? 0 : Math.round((count / total) * 100);
  }

  tone(value: string): string {
    if (['blocked', 'critical', 'off_track', 'rejected', 'overdue'].includes(value)) {
      return 'danger';
    }

    if (['in_review', 'at_risk', 'in_progress', 'clarification'].includes(value)) {
      return 'warning';
    }

    if (['done', 'approved', 'resolved', 'closed', 'on_track'].includes(value)) {
      return 'success';
    }

    return 'neutral';
  }
}
