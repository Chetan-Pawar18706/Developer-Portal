import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

interface PlaceholderData {
  title: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, EmptyStateComponent],
  template: `
    <mat-card appearance="outlined" class="placeholder-card">
      <mat-card-content>
        <app-empty-state
          [icon]="data().icon"
          [title]="data().title"
          [message]="data().description"
        />
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .placeholder-card {
      border-radius: 0.9rem;
      background: var(--mat-sys-surface-container-low);
    }
  `,
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly data = toSignal(
    this.route.data.pipe(
      map((data): PlaceholderData => ({
        title: String(data['title'] ?? 'Coming soon'),
        icon: String(data['icon'] ?? 'construction'),
        description: String(
          data['description'] ?? 'This part of the workspace is still being prepared.',
        ),
      })),
    ),
    {
      initialValue: {
        title: 'Coming soon',
        icon: 'construction',
        description: 'This part of the workspace is still being prepared.',
      },
    },
  );
}
