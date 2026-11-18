import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import type { Notification, NotificationType } from '../../core/models/notification.model';
import {
  NOTIFICATION_TYPE_LABELS,
} from '../../core/models/notification.model';
import { NotificationService } from '../../core/services/notification.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../shared/components/loading-skeleton/loading-skeleton.component';
import { getErrorMessage } from '../../shared/utils/http-error';

@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    EmptyStateComponent,
    LoadingSkeletonComponent,
  ],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  readonly notifications = signal<readonly Notification[]>([]);
  readonly total = signal(0);
  readonly unreadOnly = signal(false);
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly rangeStart = computed(() =>
    this.total() === 0 ? 0 : (this.page() - 1) * this.limit() + 1,
  );
  readonly rangeEnd = computed(() =>
    Math.min(this.page() * this.limit(), this.total()),
  );

  ngOnInit(): void {
    this.load();
  }

  onFilterChange(unreadOnly: boolean): void {
    this.unreadOnly.set(unreadOnly);
    this.page.set(1);
    this.load();
  }

  onPage(event: PageEvent): void {
    if (event.pageSize !== this.limit()) {
      this.limit.set(event.pageSize);
      this.page.set(1);
    } else {
      this.page.set(event.pageIndex + 1);
    }

    this.load();
  }

  markAsRead(notification: Notification, event: Event): void {
    event.stopPropagation();

    if (notification.isRead) {
      return;
    }

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => this.load(),
      error: (error: unknown) =>
        this.error.set(getErrorMessage(error, 'Unable to update notification.')),
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => this.load(),
      error: (error: unknown) =>
        this.error.set(getErrorMessage(error, 'Unable to update notifications.')),
    });
  }

  open(notification: Notification): void {
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => undefined,
        error: () => undefined,
      });
    }

    void this.router.navigateByUrl(notification.link);
  }

  icon(type: NotificationType): string {
    switch (type) {
      case 'task_assigned':
        return 'assignment';
      case 'mention':
        return 'alternate_email';
      case 'issue_status_changed':
        return 'bug_report';
      case 'task_client_review':
      case 'task_due_reminder':
      case 'task_overdue':
        return 'task_alt';
      case 'project_status_changed':
        return 'folder_open';
      case 'requirement_status_changed':
        return 'assignment_turned_in';
    }
  }

  label(type: NotificationType): string {
    return NOTIFICATION_TYPE_LABELS[type];
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.notificationService
      .list({
        unreadOnly: this.unreadOnly(),
        page: this.page(),
        limit: this.limit(),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
      .subscribe({
        next: (result) => {
          this.notifications.set(result.data);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(getErrorMessage(error, 'Unable to load notifications.'));
          this.notifications.set([]);
          this.total.set(0);
          this.loading.set(false);
        },
      });
  }
}
