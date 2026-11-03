import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="empty-state">
      <div class="empty-icon">
        <mat-icon>{{ icon() }}</mat-icon>
      </div>
      <h3>{{ title() }}</h3>
      @if (message()) {
        <p>{{ message() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 3rem 1.5rem;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }

    .empty-icon {
      display: grid;
      place-items: center;
      width: 4rem;
      height: 4rem;
      border-radius: 50%;
      background: var(--mat-sys-surface-container-high);
      margin-bottom: 0.5rem;
    }

    .empty-icon mat-icon {
      width: 2rem;
      height: 2rem;
      font-size: 2rem;
    }

    h3 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 600;
      color: var(--mat-sys-on-surface);
    }

    p {
      margin: 0;
      max-width: 32rem;
      font-size: 0.9rem;
      line-height: 1.5;
    }
  `,
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input('Nothing here yet');
  readonly message = input('');
}
