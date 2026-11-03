import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ROLE_LABELS } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { HasRoleDirective } from '../../shared/directives/has-role.directive';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

interface SummaryCard {
  label: string;
  icon: string;
  hint: string;
}

const SUMMARY_CARDS: readonly SummaryCard[] = [
  { label: 'Active projects', icon: 'folder_open', hint: 'Projects in flight' },
  { label: 'Open tasks', icon: 'task_alt', hint: 'Assigned to you' },
  { label: 'Open issues', icon: 'bug_report', hint: 'Waiting on a fix' },
  { label: 'Pending approvals', icon: 'pending_actions', hint: 'Needs your review' },
];

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    StatusBadgeComponent,
    HasRoleDirective,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.currentUser;
  readonly role = this.auth.role;

  readonly firstName = computed(() => this.user()?.name.trim().split(/\s+/)[0] ?? 'there');

  readonly roleLabel = computed(() => {
    const role = this.role();
    return role ? ROLE_LABELS[role] : 'Guest';
  });

  readonly cards = SUMMARY_CARDS;
}
