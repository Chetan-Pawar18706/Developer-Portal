import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-loading-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skeleton-list" role="status" aria-label="Loading content">
      @for (row of items(); track $index) {
        <div class="skeleton-row">
          <span class="skeleton skeleton-avatar"></span>
          <span class="skeleton skeleton-line" [style.width]="lineWidth($index)"></span>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .skeleton-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem 0;
    }

    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .skeleton {
      display: block;
      border-radius: 0.5rem;
      background: linear-gradient(
        90deg,
        var(--mat-sys-surface-container) 25%,
        var(--mat-sys-surface-container-high) 50%,
        var(--mat-sys-surface-container) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }

    .skeleton-avatar {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .skeleton-line {
      height: 0.9rem;
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .skeleton {
        animation: none;
      }
    }
  `,
})
export class LoadingSkeletonComponent {
  readonly rows = input(4);

  readonly items = computed(() =>
    Array.from({ length: Math.max(1, this.rows()) }, (_, index) => index),
  );

  lineWidth(index: number): string {
    return `${60 + ((index * 13) % 35)}%`;
  }
}
