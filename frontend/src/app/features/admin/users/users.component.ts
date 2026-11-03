import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { ROLES, ROLE_LABELS, type Role, type User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { UserAvatarComponent } from '../../../shared/components/user-avatar/user-avatar.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';
import { ConfirmDialogService } from '../../../shared/services/confirm-dialog.service';
import { PaginatedTable } from '../../../shared/utils/pagination';
import { CreateUserDialogComponent } from './create-user-dialog.component';
import { UserAdminService } from '../services/user-admin.service';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-admin-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    UserAvatarComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
    LoadingSkeletonComponent,
    TimeAgoPipe,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private readonly userAdmin = inject(UserAdminService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly snackBar = inject(MatSnackBar);

  readonly table = new PaginatedTable<User>({
    pageSize: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  readonly roles = ROLES;
  readonly roleLabels = ROLE_LABELS;
  readonly displayedColumns = ['name', 'email', 'role', 'status', 'createdAt', 'actions'];

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly roleFilter = signal<Role | ''>('');
  readonly statusFilter = signal<StatusFilter>('all');

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        this.table.setPage(1);
        this.load();
      });
  }

  ngOnInit(): void {
    this.load();
  }

  searchTerm(): string {
    return this.searchControl.value.trim();
  }

  onRoleFilter(role: Role | ''): void {
    this.roleFilter.set(role);
    this.table.setPage(1);
    this.load();
  }

  onStatusFilter(status: StatusFilter): void {
    this.statusFilter.set(status);
    this.table.setPage(1);
    this.load();
  }

  onPage(event: PageEvent): void {
    if (event.pageSize !== this.table.limit()) {
      this.table.setPageSize(event.pageSize);
    }

    this.table.setPage(event.pageIndex + 1);
    this.load();
  }

  onSort(sort: Sort): void {
    if (!sort.direction) {
      return;
    }

    this.table.setSort(sort.active, sort.direction);
    this.load();
  }

  isSelf(user: User): boolean {
    return this.auth.currentUser()?.id === user.id;
  }

  createUser(): void {
    this.dialog
      .open<CreateUserDialogComponent, void, User>(CreateUserDialogComponent, {
        width: '30rem',
        maxWidth: '92vw',
        autoFocus: 'first-tabbable',
      })
      .afterClosed()
      .subscribe((createdUser) => {
        if (!createdUser) {
          return;
        }

        this.snackBar.open('User created', 'Dismiss', { duration: 3000 });
        this.table.setPage(1);
        this.load();
      });
  }

  changeRole(user: User, role: Role): void {
    if (role === user.role) {
      return;
    }

    this.userAdmin.updateRole(user.id, role).subscribe({
      next: (updated) => {
        this.replaceUser(updated);
        this.snackBar.open('Role updated', 'Dismiss', { duration: 3000 });
      },
      error: () => {
        this.load();
      },
    });
  }

  toggleStatus(user: User): void {
    const activating = !user.isActive;

    this.confirmDialog
      .confirm({
        title: activating ? 'Activate user' : 'Deactivate user',
        message: activating
          ? `Restore access for ${user.name}? They will be able to sign in again.`
          : `Deactivate ${user.name}? Their active sessions will stop working.`,
        confirmLabel: activating ? 'Activate' : 'Deactivate',
        tone: activating ? 'primary' : 'warn',
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.userAdmin.updateStatus(user.id, activating).subscribe({
          next: (updated) => {
            this.replaceUser(updated);
            this.snackBar.open(
              activating ? 'User activated' : 'User deactivated',
              'Dismiss',
              { duration: 3000 },
            );
          },
          error: () => {
            this.load();
          },
        });
      });
  }

  private load(): void {
    this.table.loading.set(true);

    const status = this.statusFilter();
    const role = this.roleFilter();

    this.userAdmin
      .list({
        page: this.table.page(),
        limit: this.table.limit(),
        sortBy: this.table.sortBy() || 'createdAt',
        sortOrder: this.table.sortOrder(),
        search: this.searchTerm() || undefined,
        role: role || undefined,
        isActive: status === 'all' ? undefined : status === 'active',
      })
      .subscribe({
        next: (result) => {
          this.table.setResult(result);
          this.table.loading.set(false);
        },
        error: () => {
          this.table.loading.set(false);
        },
      });
  }

  private replaceUser(updated: User): void {
    this.table.rows.update((rows) =>
      rows.map((row) => (row.id === updated.id ? updated : row)),
    );
  }
}
