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
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs';
import {
  ISSUE_SEVERITIES,
  ISSUE_SEVERITY_LABELS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPES,
  ISSUE_TYPE_LABELS,
  type Issue,
  type IssueSeverity,
  type IssueStatus,
  type IssueType,
} from '../../../core/models/issue.model';
import { AuthService } from '../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ProjectStore } from '../../projects/project.store';
import {
  IssueCreateDialogComponent,
  type IssueCreateDialogData,
} from '../issue-create-dialog.component';
import { IssueStore } from '../issue.store';

@Component({
  selector: 'app-issue-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './issue-list.component.html',
  styleUrl: './issue-list.component.scss',
})
export class IssueListComponent implements OnInit {
  readonly store = inject(IssueStore);
  readonly projectStore = inject(ProjectStore);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly projectId = signal('');
  readonly types = ISSUE_TYPES;
  readonly typeLabels = ISSUE_TYPE_LABELS;
  readonly severities = ISSUE_SEVERITIES;
  readonly severityLabels = ISSUE_SEVERITY_LABELS;
  readonly statuses = ISSUE_STATUSES;
  readonly statusLabels = ISSUE_STATUS_LABELS;
  readonly displayColumns = [
    'title',
    'type',
    'severity',
    'status',
    'assignee',
    'age',
    'updatedAt',
  ];

  readonly canCreate = computed(() => Boolean(this.auth.currentUser()));
  readonly assigneeOptions = computed(() =>
    (this.projectStore.selected()?.members ?? []).filter(
      (member) => member.user.role !== 'client',
    ),
  );

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((value) => this.store.setSearch(value.trim()));
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map(() =>
          this.route.snapshot.pathFromRoot
            .map((snapshot) => snapshot.paramMap.get('id'))
            .find((value): value is string => Boolean(value)),
        ),
        filter((id): id is string => Boolean(id)),
        distinctUntilChanged(),
      )
      .subscribe((projectId) => {
        this.projectId.set(projectId);
        this.searchControl.setValue(this.store.filters().search, { emitEvent: false });
        this.store.load(projectId);
      });
  }

  onTypeChange(type: IssueType | ''): void {
    this.store.setType(type);
  }

  onSeverityChange(severity: IssueSeverity | ''): void {
    this.store.setSeverity(severity);
  }

  onStatusChange(status: IssueStatus | ''): void {
    this.store.setStatus(status);
  }

  onAssigneeChange(assigneeId: string): void {
    this.store.setAssignee(assigneeId);
  }

  onPage(event: PageEvent): void {
    if (event.pageSize !== this.store.filters().limit) {
      this.store.setPageSize(event.pageSize);
      return;
    }

    this.store.setPage(event.pageIndex + 1);
  }

  openIssue(issue: Issue): void {
    this.router.navigate(['/projects', this.projectId(), 'issues', issue.id]);
  }

  openCreateDialog(): void {
    this.dialog
      .open<IssueCreateDialogComponent, IssueCreateDialogData, Issue | undefined>(
        IssueCreateDialogComponent,
        { data: { projectId: this.projectId() }, width: '640px', maxWidth: '95vw' },
      )
      .afterClosed()
      .subscribe((issue) => {
        if (issue) {
          this.openIssue(issue);
        }
      });
  }

  typeLabel(type: IssueType): string {
    return this.typeLabels[type];
  }

  severityLabel(severity: IssueSeverity): string {
    return this.severityLabels[severity];
  }

  statusLabel(status: IssueStatus): string {
    return this.statusLabels[status];
  }

  daysOpen(issue: Issue): number {
    const end = issue.status === 'closed' ? new Date(issue.updatedAt) : new Date();
    const started = new Date(issue.createdAt).getTime();
    return Math.max(0, Math.floor((end.getTime() - started) / 86_400_000));
  }

  ageTone(issue: Issue): string {
    const days = this.daysOpen(issue);

    if (issue.status === 'closed') {
      return 'closed';
    }

    if (days >= 14) {
      return 'critical';
    }

    if (days >= 7) {
      return 'stale';
    }

    if (days >= 3) {
      return 'aging';
    }

    return 'fresh';
  }
}
