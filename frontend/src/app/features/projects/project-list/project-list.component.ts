import { CurrencyPipe, DatePipe } from '@angular/common';
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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  PROJECT_PRIORITIES,
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  type Project,
  type ProjectPriority,
  type ProjectStatus,
} from '../../../core/models/project.model';
import { AuthService } from '../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { ProjectStore } from '../project.store';

type ProjectView = 'cards' | 'table';

@Component({
  selector: 'app-project-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    CurrencyPipe,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
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
    UserAvatarComponent,
  ],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
})
export class ProjectListComponent implements OnInit {
  readonly store = inject(ProjectStore);
  private readonly auth = inject(AuthService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly view = signal<ProjectView>('cards');
  readonly statuses = PROJECT_STATUSES;
  readonly statusLabels = PROJECT_STATUS_LABELS;
  readonly priorities = PROJECT_PRIORITIES;
  readonly priorityLabels = PROJECT_PRIORITY_LABELS;
  readonly displayColumns = ['title', 'client', 'status', 'priority', 'dueDate', 'members'];

  readonly canCreate = computed(() => {
    const role = this.auth.role();
    return role === 'admin' || role === 'pm' || role === 'client';
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => this.store.setSearch(value.trim()));
  }

  ngOnInit(): void {
    this.store.load();
  }

  onStatusChange(status: ProjectStatus | ''): void {
    this.store.setStatus(status);
  }

  onPage(event: PageEvent): void {
    if (event.pageSize !== this.store.filters().limit) {
      this.store.setPageSize(event.pageSize);
      return;
    }

    this.store.setPage(event.pageIndex + 1);
  }

  statusLabel(status: ProjectStatus): string {
    return this.statusLabels[status];
  }

  priorityLabel(priority: ProjectPriority): string {
    return this.priorityLabels[priority];
  }

  projectLead(project: Project): string {
    return project.members[0]?.user.name ?? project.client.name;
  }

  memberNames(project: Project): string {
    return project.members.map((member) => member.user.name).join(', ');
  }
}
