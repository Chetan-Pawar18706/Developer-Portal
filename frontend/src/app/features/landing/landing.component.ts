import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

interface Feature {
  icon: string;
  tag: string;
  title: string;
  description: string;
}

interface WorkflowStep {
  icon: string;
  title: string;
  description: string;
}

interface RoleCard {
  icon: string;
  title: string;
  description: string;
}

const FEATURES: readonly Feature[] = [
  {
    icon: 'assignment_turned_in',
    tag: 'Scope',
    title: 'Requirements clients can follow',
    description:
      'Clients submit requirements in their own words. Your PM approves, asks for changes or rejects — and every decision stays on the record.',
  },
  {
    icon: 'task_alt',
    tag: 'Delivery',
    title: 'Tasks with a clear owner',
    description:
      'Break approved work into tasks, assign developers, track status and log time without leaving the project.',
  },
  {
    icon: 'bug_report',
    tag: 'Quality',
    title: 'Issues that close the loop',
    description:
      'Raise a blocker, connect it to the project and follow it through to resolution with a visible owner and history.',
  },
  {
    icon: 'folder_shared',
    tag: 'Files',
    title: 'Shared files, private when needed',
    description:
      'Exchange briefs and deliverables in one place, with internal-only uploads your clients never receive.',
  },
  {
    icon: 'forum',
    tag: 'Discussion',
    title: 'Conversations in context',
    description:
      'Threaded comments keep decisions beside the requirement, task or issue they belong to. Internal notes stay internal.',
  },
  {
    icon: 'verified',
    tag: 'Sign-off',
    title: 'A clean finish, every time',
    description:
      'Clients review the delivery, discuss the details and sign off, with an audit trail of what changed and when.',
  },
];

const STEPS: readonly WorkflowStep[] = [
  {
    icon: 'add_business',
    title: 'Create the project',
    description:
      'A client opens a project and captures what they need. Your team gets a structured brief instead of scattered emails.',
  },
  {
    icon: 'fact_check',
    title: 'Review requirements',
    description:
      'The PM approves, rejects or asks for clarification. Approved requirements become the shared scope of work.',
  },
  {
    icon: 'engineering',
    title: 'Plan, build, unblock',
    description:
      'Tasks are assigned to developers, progress is visible in real time, and issues surface early — not at the demo.',
  },
  {
    icon: 'handshake',
    title: 'Review and sign off',
    description:
      'Clients review the delivery, discuss the details and sign off. The audit trail is already written for you.',
  },
];

const ROLES: readonly RoleCard[] = [
  {
    icon: 'business_center',
    title: 'Clients',
    description: 'See only their own projects, approve requirements and sign off on delivery.',
  },
  {
    icon: 'manage_accounts',
    title: 'Project managers',
    description: 'Turn client input into assigned tasks, manage members and track delivery.',
  },
  {
    icon: 'code',
    title: 'Developers',
    description: 'Focus on assigned tasks, log time, discuss in context and upload files.',
  },
  {
    icon: 'admin_panel_settings',
    title: 'Admins',
    description: 'Manage users, oversee every project and keep access and activity in order.',
  },
];

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly primaryRoute = computed(() => (this.isLoggedIn() ? '/dashboard' : '/auth/register'));
  readonly primaryLabel = computed(() =>
    this.isLoggedIn() ? 'Open dashboard' : 'Start a project',
  );

  readonly features = FEATURES;
  readonly steps = STEPS;
  readonly roles = ROLES;
  readonly year = new Date().getFullYear();
}
