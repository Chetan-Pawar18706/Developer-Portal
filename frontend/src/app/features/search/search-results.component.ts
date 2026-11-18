import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import type { SearchResult } from '../../core/models/search.model';
import { SearchService } from '../../core/services/search.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { getErrorMessage } from '../../shared/utils/http-error';

@Component({
  selector: 'app-search-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './search-results.component.html',
  styleUrl: './search-results.component.scss',
})
export class SearchResultsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly searchService = inject(SearchService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly query = signal('');
  readonly result = signal<SearchResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searched = signal(false);

  readonly canSearch = computed(() => this.query().trim().length >= 2);
  readonly groups = computed(() =>
    (this.result()?.groups ?? []).filter((group) => group.items.length > 0),
  );
  readonly total = computed(() => this.result()?.total ?? 0);

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { q: value.trim() || null },
          queryParamsHandling: 'merge',
        });
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const query = params.get('q')?.trim() ?? '';
      this.query.set(query);
      this.searchControl.setValue(query, { emitEvent: false });

      if (query.length >= 2) {
        this.runSearch(query);
      } else {
        this.result.set(null);
        this.error.set(null);
        this.loading.set(false);
        this.searched.set(false);
      }
    });
  }

  retry(): void {
    this.runSearch(this.query());
  }

  clear(): void {
    this.searchControl.setValue('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge',
    });
  }

  private runSearch(query: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.searched.set(true);

    this.searchService.search(query, 20).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.result.set(null);
        this.error.set(getErrorMessage(error, 'Unable to search the workspace.'));
        this.loading.set(false);
      },
    });
  }
}
