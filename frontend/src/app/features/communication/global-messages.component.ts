import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import type { Comment, CommentEntityType, GlobalCommentListQuery } from '../../core/models/comment.model';
import { COMMENT_ENTITY_TYPES } from '../../core/models/comment.model';
import type { Project, ProjectListQuery } from '../../core/models/project.model';
import { CommentService } from '../../core/services/comment.service';
import { ProjectService } from '../../core/services/project.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';
import { getErrorMessage } from '../../shared/utils/http-error';

const ENTITY_LABELS: Record<CommentEntityType, string> = {
  project: 'Project discussion',
  requirement: 'Requirement',
  task: 'Task',
  issue: 'Issue',
};

@Component({
  selector: 'app-global-messages',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTooltipModule,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    UserAvatarComponent,
  ],
  templateUrl: './global-messages.component.html',
  styleUrl: './global-messages.component.scss',
})
export class GlobalMessagesComponent implements OnInit {
  private readonly commentService = inject(CommentService);
  private readonly projectService = inject(ProjectService);
  private readonly destroyRef = inject(DestroyRef);

  readonly entityTypes = COMMENT_ENTITY_TYPES;
  readonly entityLabels = ENTITY_LABELS;
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly projectControl = new FormControl('', { nonNullable: true });
  readonly entityControl = new FormControl<CommentEntityType | ''>('', { nonNullable: true });

  readonly projects = signal<readonly Project[]>([]);
  readonly comments = signal<readonly Comment[]>([]);
  readonly filters = signal<GlobalCommentListQuery>({ page: 1, limit: 20 });
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal('');

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.setFilters({ search: value.trim() || undefined, page: 1 }));

    this.projectControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.setFilters({ projectId: value || undefined, page: 1 }));

    this.entityControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.setFilters({ entityType: value || undefined, page: 1 }));

    this.loadProjects();
    this.loadComments();
  }

  onPage(event: PageEvent): void {
    this.setFilters({ page: event.pageIndex + 1, limit: event.pageSize });
  }

  reload(): void {
    this.loadComments();
  }

  entityLabel(type: CommentEntityType): string {
    return ENTITY_LABELS[type];
  }

  threadLink(comment: Comment): readonly (string | number)[] {
    if (comment.entityType === 'project') {
      return ['/projects', comment.projectId, 'discussion'];
    }

    if (comment.entityType === 'requirement') {
      return ['/projects', comment.projectId, 'requirements', comment.entityId];
    }

    if (comment.entityType === 'issue') {
      return ['/projects', comment.projectId, 'issues', comment.entityId];
    }

    return ['/projects', comment.projectId, 'tasks'];
  }

  private setFilters(patch: Partial<GlobalCommentListQuery>): void {
    this.filters.update((filters) => ({ ...filters, ...patch }));
    this.loadComments();
  }

  private loadProjects(): void {
    const query: ProjectListQuery = {
      search: '',
      page: 1,
      limit: 100,
      sortBy: 'title',
      sortOrder: 'asc',
    };

    this.projectService.list(query).subscribe({
      next: (result) => this.projects.set(result.data),
      error: () => this.projects.set([]),
    });
  }

  private loadComments(): void {
    this.loading.set(true);
    this.error.set('');

    this.commentService
      .listGlobal(this.filters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.comments.set(result.data);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(getErrorMessage(error, 'Unable to load messages.'));
          this.comments.set([]);
          this.total.set(0);
          this.loading.set(false);
        },
      });
  }
}
