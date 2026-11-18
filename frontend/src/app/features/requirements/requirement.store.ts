import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, tap } from 'rxjs';
import type {
  CreateChangeRequestRequest,
  CreateRequirementRequest,
  Requirement,
  RequirementFilters,
  RequirementPriority,
  RequirementStatus,
  RequirementType,
  UpdateRequirementRequest,
  UpdateRequirementStatusRequest,
} from '../../core/models/requirement.model';
import { RealtimeService } from '../../core/services/realtime.service';
import { RequirementService } from '../../core/services/requirement.service';
import { getErrorMessage } from '../../shared/utils/http-error';

const DEFAULT_FILTERS: RequirementFilters = {
  search: '',
  status: '',
  priority: '',
  type: '',
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

@Injectable({ providedIn: 'root' })
export class RequirementStore {
  private readonly requirementService = inject(RequirementService);
  private readonly realtime = inject(RealtimeService);
  private readonly projectId = signal('');

  readonly entities = signal<readonly Requirement[]>([]);
  readonly selected = signal<Requirement | null>(null);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly selectedLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly filters = signal<RequirementFilters>({ ...DEFAULT_FILTERS });

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.filters().limit))),
  );

  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.filters().page - 1) * this.filters().limit + 1,
  );

  readonly rangeEnd = computed(() =>
    Math.min(this.filters().page * this.filters().limit, this.total()),
  );

  constructor() {
    const applyRequirement = (requirement: Requirement): void => {
      if (requirement.projectId === this.projectId()) {
        this.applyRequirement(requirement);
      }
    };

    this.realtime.requirementCreated$.pipe(takeUntilDestroyed()).subscribe(applyRequirement);
    this.realtime.requirementUpdated$.pipe(takeUntilDestroyed()).subscribe(applyRequirement);
  }

  load(projectId: string): void {
    if (this.projectId() !== projectId) {
      this.projectId.set(projectId);
      this.filters.set({ ...DEFAULT_FILTERS });
    }

    const { search, status, priority, type, page, limit, sortBy, sortOrder } = this.filters();

    this.loading.set(true);
    this.error.set(null);

    this.requirementService
      .list(projectId, {
        search,
        status: status || undefined,
        priority: priority || undefined,
        type: type || undefined,
        page,
        limit,
        sortBy,
        sortOrder,
      })
      .subscribe({
        next: (result) => {
          this.entities.set(result.data);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(getErrorMessage(error, 'Unable to load requirements.'));
          this.loading.set(false);
        },
      });
  }

  reload(): void {
    if (this.projectId()) {
      this.load(this.projectId());
    }
  }

  setSearch(search: string): void {
    this.filters.update((filters) => ({ ...filters, search, page: 1 }));
    this.reload();
  }

  setStatus(status: RequirementStatus | ''): void {
    this.filters.update((filters) => ({ ...filters, status, page: 1 }));
    this.reload();
  }

  setPriority(priority: RequirementPriority | ''): void {
    this.filters.update((filters) => ({ ...filters, priority, page: 1 }));
    this.reload();
  }

  setType(type: RequirementType | ''): void {
    this.filters.update((filters) => ({ ...filters, type, page: 1 }));
    this.reload();
  }

  setPage(page: number): void {
    this.filters.update((filters) => ({
      ...filters,
      page: Math.min(Math.max(1, page), this.pageCount()),
    }));
    this.reload();
  }

  setPageSize(limit: number): void {
    this.filters.update((filters) => ({ ...filters, limit, page: 1 }));
    this.reload();
  }

  loadOne(requirementId: string): void {
    this.selectedLoading.set(true);
    this.error.set(null);

    this.requirementService.get(requirementId).subscribe({
      next: (requirement) => {
        this.selected.set(requirement);
        this.selectedLoading.set(false);
      },
      error: (error: unknown) => {
        this.selected.set(null);
        this.error.set(getErrorMessage(error, 'Unable to load this requirement.'));
        this.selectedLoading.set(false);
      },
    });
  }

  clearSelected(): void {
    this.selected.set(null);
  }

  create(projectId: string, input: CreateRequirementRequest): Observable<Requirement> {
    return this.requirementService
      .create(projectId, input)
      .pipe(tap((requirement) => this.applyRequirement(requirement)));
  }

  update(requirementId: string, input: UpdateRequirementRequest): Observable<Requirement> {
    return this.requirementService
      .update(requirementId, input)
      .pipe(tap((requirement) => this.applyRequirement(requirement)));
  }

  changeStatus(
    requirementId: string,
    input: UpdateRequirementStatusRequest,
  ): Observable<Requirement> {
    return this.requirementService
      .updateStatus(requirementId, input)
      .pipe(tap((requirement) => this.applyRequirement(requirement)));
  }

  createChangeRequest(
    requirementId: string,
    input: CreateChangeRequestRequest,
  ): Observable<Requirement> {
    return this.requirementService
      .createChangeRequest(requirementId, input)
      .pipe(tap((requirement) => this.applyRequirement(requirement)));
  }

  private applyRequirement(requirement: Requirement): void {
    this.selected.update((selected) => (selected?.id === requirement.id ? requirement : selected));

    this.entities.update((entities) => {
      const existing = entities.some((entity) => entity.id === requirement.id);
      return existing
        ? entities.map((entity) => (entity.id === requirement.id ? requirement : entity))
        : [requirement, ...entities];
    });
  }
}
