import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs';
import {
  REQUIREMENT_PRIORITIES,
  REQUIREMENT_PRIORITY_LABELS,
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_TYPES,
  REQUIREMENT_TYPE_LABELS,
  type Requirement,
  type RequirementPriority,
  type RequirementStatus,
  type RequirementType,
} from '../../../core/models/requirement.model';
import { AuthService } from '../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ProjectStore } from '../../projects/project.store';
import { RequirementStore } from '../requirement.store';

@Component({
  selector: 'app-requirement-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    StatusBadgeComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './requirement-list.component.html',
  styleUrl: './requirement-list.component.scss',
})
export class RequirementListComponent implements OnInit {
  readonly store = inject(RequirementStore);
  readonly projectStore = inject(ProjectStore);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly projectId = signal('');
  readonly statuses = REQUIREMENT_STATUSES;
  readonly statusLabels = REQUIREMENT_STATUS_LABELS;
  readonly priorities = REQUIREMENT_PRIORITIES;
  readonly priorityLabels = REQUIREMENT_PRIORITY_LABELS;
  readonly types = REQUIREMENT_TYPES;
  readonly typeLabels = REQUIREMENT_TYPE_LABELS;
  readonly displayColumns = ['title', 'type', 'priority', 'status', 'updatedAt'];

  readonly canCreate = computed(() => {
    const role = this.auth.role();
    const project = this.projectStore.selected();

    if (role === 'admin' || role === 'pm') {
      return true;
    }

    return role === 'client' && project?.client.id === this.auth.currentUser()?.id;
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => this.store.setSearch(value.trim()));
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map(() => {
          return (
            this.route.snapshot.pathFromRoot
              .map((snapshot) => snapshot.paramMap.get('id'))
              .find((value): value is string => Boolean(value)) ?? ''
          );
        }),
        filter((id) => id.length > 0),
        distinctUntilChanged(),
      )
      .subscribe((projectId) => {
        this.projectId.set(projectId);
        this.searchControl.setValue(this.store.filters().search, { emitEvent: false });
        this.store.load(projectId);
      });
  }

  onStatusChange(status: RequirementStatus | ''): void {
    this.store.setStatus(status);
  }

  onPriorityChange(priority: RequirementPriority | ''): void {
    this.store.setPriority(priority);
  }

  onTypeChange(type: RequirementType | ''): void {
    this.store.setType(type);
  }

  onPage(event: PageEvent): void {
    if (event.pageSize !== this.store.filters().limit) {
      this.store.setPageSize(event.pageSize);
      return;
    }

    this.store.setPage(event.pageIndex + 1);
  }

  openRequirement(requirement: Requirement): void {
    this.router.navigate(['/projects', this.projectId(), 'requirements', requirement.id]);
  }

  statusLabel(status: RequirementStatus): string {
    return this.statusLabels[status];
  }

  priorityLabel(priority: RequirementPriority): string {
    return this.priorityLabels[priority];
  }

  typeLabel(type: RequirementType): string {
    return this.typeLabels[type];
  }
}
