import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <section class="error-page" aria-labelledby="not-found-title">
      <div class="error-icon"><mat-icon>explore_off</mat-icon></div>
      <p class="error-code">404</p>
      <h1 id="not-found-title">We couldn’t find that page</h1>
      <p class="error-copy">
        The link may be outdated, or the item may have been moved. Head back to your dashboard or
        search the workspace to find what you need.
      </p>
      <div class="error-actions">
        <a mat-flat-button routerLink="/dashboard">
          <mat-icon>space_dashboard</mat-icon>
          Back to dashboard
        </a>
        <a mat-stroked-button routerLink="/search">
          <mat-icon>search</mat-icon>
          Search workspace
        </a>
        <button mat-stroked-button type="button" (click)="retry()">
          <mat-icon>refresh</mat-icon>
          Try again
        </button>
      </div>
    </section>
  `,
  styles: `
    .error-page {
      display: flex;
      min-height: 70dvh;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 2rem 1rem;
      text-align: center;
    }

    .error-icon {
      display: grid;
      place-items: center;
      width: 5rem;
      height: 5rem;
      border-radius: 50%;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-primary);
    }

    .error-icon mat-icon {
      width: 2.5rem;
      height: 2.5rem;
      font-size: 2.5rem;
    }

    .error-code {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-primary);
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.12em;
    }

    h1 {
      margin: 0;
      font-size: clamp(1.5rem, 4vw, 2.1rem);
      letter-spacing: -0.02em;
    }

    .error-copy {
      max-width: 34rem;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      line-height: 1.6;
    }

    .error-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.75rem;
      margin-top: 1rem;
    }
  `,
})
export class NotFoundComponent {
  retry(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
