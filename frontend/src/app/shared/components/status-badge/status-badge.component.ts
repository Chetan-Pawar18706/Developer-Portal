import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE_BY_STATUS: Record<string, StatusTone> = {
  done: 'success',
  completed: 'success',
  approved: 'success',
  active: 'success',
  resolved: 'success',
  in_review: 'warning',
  'in-review': 'warning',
  review: 'warning',
  pending: 'warning',
  in_progress: 'warning',
  'in-progress': 'warning',
  todo: 'warning',
  blocked: 'danger',
  critical: 'danger',
  rejected: 'danger',
  inactive: 'danger',
  cancelled: 'danger',
  overdue: 'danger',
  draft: 'neutral',
  backlog: 'neutral',
  archived: 'neutral',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="status-badge" [class]="'tone-' + tone()">
      <span class="status-dot"></span>
      {{ displayLabel() }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 500;
      line-height: 1.4;
      white-space: nowrap;
      color: var(--status-fg);
      background: var(--status-bg);
      border: 1px solid var(--status-border);
    }

    .status-dot {
      width: 0.45rem;
      height: 0.45rem;
      border-radius: 50%;
      background: var(--status-fg);
    }

    .tone-success {
      --status-fg: var(--status-done);
      --status-bg: var(--status-done-bg);
      --status-border: var(--status-done-border);
    }

    .tone-warning {
      --status-fg: var(--status-review);
      --status-bg: var(--status-review-bg);
      --status-border: var(--status-review-border);
    }

    .tone-danger {
      --status-fg: var(--status-blocked);
      --status-bg: var(--status-blocked-bg);
      --status-border: var(--status-blocked-border);
    }

    .tone-neutral {
      --status-fg: var(--status-draft);
      --status-bg: var(--status-draft-bg);
      --status-border: var(--status-draft-border);
    }
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  readonly label = input<string | null>(null);

  readonly tone = computed<StatusTone>(
    () => TONE_BY_STATUS[this.status().trim().toLowerCase()] ?? 'neutral',
  );

  readonly displayLabel = computed(() => {
    const override = this.label();

    if (override) {
      return override;
    }

    return this.status()
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  });
}
