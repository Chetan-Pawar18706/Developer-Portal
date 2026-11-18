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
import type { PortfolioReport, StatusCount } from '../../core/models/report.model';
import { ReportService } from '../../core/services/report.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
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
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly report = signal<PortfolioReport | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    const projectId = this.route.parent?.snapshot.paramMap.get('id') ?? undefined;
    this.load(projectId);
  }

  load(projectId?: string): void {
    this.loading.set(true);
    this.error.set('');

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

  label(value: string): string {
    return value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  barWidth(count: number, counts: readonly StatusCount[]): number {
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
