import { computed, signal } from '@angular/core';
import type { PageQuery, PaginatedData } from '../../core/models/api.model';

export interface PaginatedTableDefaults {
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Generic state holder for server-side paginated tables. Components bind the
 * signals to a MatTable and MatPaginator, then reload whenever a signal that
 * affects the query changes.
 */
export class PaginatedTable<T> {
  readonly rows = signal<readonly T[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly limit = signal(10);
  readonly sortBy = signal('');
  readonly sortOrder = signal<'asc' | 'desc'>('asc');
  readonly loading = signal(false);

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.limit()))),
  );

  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.limit() + 1,
  );

  readonly rangeEnd = computed(() => Math.min(this.page() * this.limit(), this.total()));

  readonly hasPrevious = computed(() => this.page() > 1);

  readonly hasNext = computed(() => this.page() < this.totalPages());

  constructor(defaults: PaginatedTableDefaults = {}) {
    this.limit.set(defaults.pageSize ?? 10);
    this.sortBy.set(defaults.sortBy ?? '');
    this.sortOrder.set(defaults.sortOrder ?? 'asc');
  }

  setResult(result: PaginatedData<T>): void {
    this.rows.set(result.data);
    this.total.set(result.total);
    this.page.set(result.page);
    this.limit.set(result.limit);
  }

  setPage(page: number): void {
    this.page.set(Math.min(Math.max(1, page), this.totalPages()));
  }

  setPageSize(limit: number): void {
    this.limit.set(limit);
    this.page.set(1);
  }

  setSort(sortBy: string, sortOrder: 'asc' | 'desc'): void {
    this.sortBy.set(sortBy);
    this.sortOrder.set(sortOrder);
    this.page.set(1);
  }

  nextPage(): void {
    if (this.hasNext()) {
      this.page.update((page) => page + 1);
    }
  }

  previousPage(): void {
    if (this.hasPrevious()) {
      this.page.update((page) => page - 1);
    }
  }

  toQuery(): PageQuery {
    return {
      page: this.page(),
      limit: this.limit(),
      sortBy: this.sortBy(),
      sortOrder: this.sortOrder(),
    };
  }
}
