import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

const CHART_COLORS = ['#6750a4', '#2e7d4f', '#b26a00', '#b3261e', '#1565c0', '#7b1fa2'];

@Component({
  selector: 'app-status-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseChartDirective],
  template: `
    <div class="chart-wrap">
      @if (hasData()) {
        <canvas baseChart [data]="chartData()" [options]="options" type="doughnut"></canvas>
      } @else {
        <p class="empty">No data available</p>
      }
    </div>
  `,
  styles: `
    .chart-wrap {
      position: relative;
      height: 13rem;
    }

    .empty {
      display: grid;
      place-items: center;
      height: 100%;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.85rem;
    }
  `,
})
export class StatusDonutComponent {
  readonly labels = input<readonly string[]>([]);
  readonly values = input<readonly number[]>([]);

  readonly hasData = computed(() => this.values().some((value) => value > 0));

  readonly chartData = computed<ChartData<'doughnut'>>(() => ({
    labels: [...this.labels()],
    datasets: [
      {
        data: [...this.values()],
        backgroundColor: CHART_COLORS,
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  }));

  readonly options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
    },
  };
}

@Component({
  selector: 'app-workload-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseChartDirective],
  template: `
    <div class="chart-wrap">
      @if (labels().length > 0) {
        <canvas baseChart [data]="chartData()" [options]="options" type="bar"></canvas>
      } @else {
        <p class="empty">No workload assigned yet</p>
      }
    </div>
  `,
  styles: `
    .chart-wrap {
      position: relative;
      height: 15rem;
    }

    .empty {
      display: grid;
      place-items: center;
      height: 100%;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.85rem;
    }
  `,
})
export class WorkloadBarComponent {
  readonly labels = input<readonly string[]>([]);
  readonly logged = input<readonly number[]>([]);
  readonly estimated = input<readonly number[]>([]);

  readonly chartData = computed<ChartData<'bar'>>(() => ({
    labels: [...this.labels()],
    datasets: [
      {
        label: 'Estimated hours',
        data: [...this.estimated()],
        backgroundColor: 'rgba(103, 80, 164, 0.25)',
        borderColor: '#6750a4',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Logged hours',
        data: [...this.logged()],
        backgroundColor: '#2e7d4f',
        borderRadius: 6,
      },
    ],
  }));

  readonly options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { autoSkip: false } },
      y: { beginAtZero: true, title: { display: true, text: 'Hours' } },
    },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } } },
  };
}

export interface BurnDownPointInput {
  date: string;
  remaining: number;
  ideal: number;
}

@Component({
  selector: 'app-burn-down-line',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BaseChartDirective],
  template: `
    <div class="chart-wrap">
      @if (points().length > 0) {
        <canvas baseChart [data]="chartData()" [options]="options" type="line"></canvas>
      } @else {
        <p class="empty">No burn-down data yet</p>
      }
    </div>
  `,
  styles: `
    .chart-wrap {
      position: relative;
      height: 15rem;
    }

    .empty {
      display: grid;
      place-items: center;
      height: 100%;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.85rem;
    }
  `,
})
export class BurnDownLineComponent {
  readonly points = input<readonly BurnDownPointInput[]>([]);

  readonly chartData = computed<ChartData<'line'>>(() => ({
    labels: this.points().map((point) => point.date.slice(5)),
    datasets: [
      {
        label: 'Remaining',
        data: this.points().map((point) => point.remaining),
        borderColor: '#6750a4',
        backgroundColor: 'rgba(103, 80, 164, 0.12)',
        tension: 0.35,
        fill: true,
        pointRadius: 2,
      },
      {
        label: 'Ideal',
        data: this.points().map((point) => point.ideal),
        borderColor: '#94a3b8',
        borderDash: [6, 4],
        tension: 0,
        pointRadius: 0,
      },
    ],
  }));

  readonly options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: { y: { beginAtZero: true }, x: { grid: { display: false } } },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } } },
  };
}
