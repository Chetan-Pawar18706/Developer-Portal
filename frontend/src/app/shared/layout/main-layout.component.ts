import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, of, startWith, switchMap, tap } from 'rxjs';
import type {
  Notification,
  NotificationType,
} from '../../core/models/notification.model';
import type { SearchGroup, SearchResultItem } from '../../core/models/search.model';
import { ROLE_LABELS, type Role } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { OfflineService } from '../../core/services/offline.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { SearchService } from '../../core/services/search.service';
import { ThemeService } from '../../core/services/theme.service';
import { UserAvatarComponent } from '../components/user-avatar/user-avatar.component';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: readonly Role[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', icon: 'space_dashboard', route: '/dashboard', roles: [] },
  {
    label: 'Projects',
    icon: 'folder_open',
    route: '/projects',
    roles: ['admin', 'pm', 'developer', 'client'],
  },
  {
    label: 'Requirements',
    icon: 'assignment',
    route: '/requirements',
    roles: ['admin', 'pm', 'client'],
  },
  {
    label: 'Tasks',
    icon: 'task_alt',
    route: '/tasks',
    roles: ['admin', 'pm', 'developer'],
  },
  {
    label: 'Issues',
    icon: 'bug_report',
    route: '/issues',
    roles: ['admin', 'pm', 'developer', 'client'],
  },
  {
    label: 'Files',
    icon: 'folder_shared',
    route: '/files',
    roles: ['admin', 'pm', 'developer', 'client'],
  },
  {
    label: 'Messages',
    icon: 'forum',
    route: '/communication',
    roles: ['admin', 'pm', 'developer', 'client'],
  },
  {
    label: 'Users',
    icon: 'group',
    route: '/admin/users',
    roles: ['admin'],
  },
];

@Component({
  selector: 'app-main-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatAutocompleteModule,
    MatBadgeModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatDividerModule,
    UserAvatarComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly realtime = inject(RealtimeService);
  private readonly router = inject(Router);
  private readonly breakpoint = inject(BreakpointObserver);
  private readonly searchService = inject(SearchService);
  readonly theme = inject(ThemeService);
  readonly offline = inject(OfflineService);

  readonly user = this.auth.currentUser;
  readonly role = this.auth.role;
  readonly unreadCount = signal(0);
  readonly latestNotifications = signal<readonly Notification[]>([]);

  readonly roleLabel = computed(() => {
    const role = this.role();
    return role ? ROLE_LABELS[role] : 'Guest';
  });

  readonly isHandset = toSignal(
    this.breakpoint
      .observe('(max-width: 60rem)')
      .pipe(map((result) => result.matches)),
    { initialValue: false },
  );

  readonly sidenavOpen = signal(true);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchGroups = signal<readonly SearchGroup[]>([]);
  readonly searchLoading = signal(false);
  readonly hasSearchQuery = computed(() => this.searchControl.value.trim().length >= 2);

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly navigation = computed(() => {
    const role = this.role();

    return NAV_ITEMS.filter(
      (item) => item.roles.length === 0 || (role !== null && item.roles.includes(role)),
    );
  });

  readonly pageTitle = computed(() => {
    const url = this.currentUrl();
    const staticTitles: Record<string, string> = {
      '/notifications': 'Notifications',
      '/profile': 'Profile',
    };
    const match = this.navigation().find(
      (item) => url === item.route || url.startsWith(`${item.route}/`),
    );

    return staticTitles[url] ?? match?.label ?? 'Dashboard';
  });

  constructor() {
    effect(() => {
      this.sidenavOpen.set(!this.isHandset());
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        if (this.isHandset()) {
          this.sidenavOpen.set(false);
        }
      });

    this.searchControl.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(250),
        distinctUntilChanged(),
        tap((query) => this.searchLoading.set(query.length >= 2)),
        switchMap((query) =>
          query.length < 2
            ? of([])
            : this.searchService.search(query, 6).pipe(
                map((result) => result.groups.filter((group) => group.items.length > 0)),
                catchError(() => of([])),
                finalize(() => this.searchLoading.set(false)),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((groups) => this.searchGroups.set(groups));

    this.refreshNotifications();
    this.realtime.notificationNew$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.refreshNotifications());
  }

  toggleSidenav(): void {
    this.sidenavOpen.update((open) => !open);
  }

  onNavigate(): void {
    if (this.isHandset()) {
      this.sidenavOpen.set(false);
    }
  }

  notificationIcon(type: NotificationType): string {
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

  openNotification(notification: Notification): void {
    if (!notification.isRead) {
      this.notifications.markAsRead(notification.id).subscribe({
        next: () => this.refreshNotifications(),
        error: () => undefined,
      });
    }

    void this.router.navigateByUrl(notification.link);
  }

  markAllNotificationsRead(): void {
    this.notifications.markAllAsRead().subscribe({
      next: () => this.refreshNotifications(),
      error: () => undefined,
    });
  }

  openAllNotifications(): void {
    void this.router.navigate(['/notifications']);
  }

  openSearch(query = ''): void {
    const term = (query || this.searchControl.value).trim();
    void this.router.navigate(['/search'], {
      queryParams: term.length > 0 ? { q: term } : {},
    });
    this.searchGroups.set([]);
  }

  selectSearchResult(item: SearchResultItem | null): void {
    if (!item) {
      this.openSearch();
      return;
    }

    this.searchControl.setValue('', { emitEvent: false });
    this.searchGroups.set([]);
    void this.router.navigateByUrl(item.href);
  }

  openProfile(): void {
    void this.router.navigate(['/profile']);
  }

  private refreshNotifications(): void {
    this.notifications.unreadCount().subscribe({
      next: (count) => this.unreadCount.set(count),
      error: () => undefined,
    });

    this.notifications
      .list({ page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' })
      .subscribe({
        next: (result) => this.latestNotifications.set(result.data),
        error: () => undefined,
      });
  }

  logout(): void {
    this.auth.logout().subscribe(() => {
      this.router.navigate(['/auth/login']);
    });
  }
}
