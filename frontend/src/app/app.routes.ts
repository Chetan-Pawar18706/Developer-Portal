import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing.component').then((module) => module.LandingComponent),
  },
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then((module) => module.LoginComponent),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.component').then(
            (module) => module.RegisterComponent,
          ),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password/forgot-password.component').then(
            (module) => module.ForgotPasswordComponent,
          ),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./features/auth/reset-password/reset-password.component').then(
            (module) => module.ResetPasswordComponent,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/main-layout.component').then((module) => module.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (module) => module.DashboardComponent,
          ),
      },
      {
        path: 'admin/users',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/admin/users/users.component').then((module) => module.UsersComponent),
      },
      {
        path: 'projects',
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('./features/projects/project-list/project-list.component').then(
                (module) => module.ProjectListComponent,
              ),
          },
          {
            path: 'new',
            canActivate: [roleGuard(['admin', 'pm', 'client'])],
            loadComponent: () =>
              import('./features/projects/project-create/project-create.component').then(
                (module) => module.ProjectCreateComponent,
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/projects/project-detail/project-detail.component').then(
                (module) => module.ProjectDetailComponent,
              ),
            children: [
              { path: '', pathMatch: 'full', redirectTo: 'overview' },
              {
                path: 'overview',
                loadComponent: () =>
                  import('./features/projects/project-detail/project-overview/project-overview.component').then(
                    (module) => module.ProjectOverviewComponent,
                  ),
              },
              {
                path: 'activity',
                loadComponent: () =>
                  import('./features/projects/project-detail/project-activity/project-activity.component').then(
                    (module) => module.ProjectActivityComponent,
                  ),
              },
              {
                path: 'requirements',
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./features/requirements/requirement-list/requirement-list.component').then(
                        (module) => module.RequirementListComponent,
                      ),
                  },
                  {
                    path: 'new',
                    canActivate: [roleGuard(['admin', 'pm', 'client'])],
                    data: { mode: 'create' },
                    loadComponent: () =>
                      import('./features/requirements/requirement-form/requirement-form.component').then(
                        (module) => module.RequirementFormComponent,
                      ),
                  },
                  {
                    path: ':requirementId/edit',
                    canActivate: [roleGuard(['admin', 'pm', 'client'])],
                    data: { mode: 'edit' },
                    loadComponent: () =>
                      import('./features/requirements/requirement-form/requirement-form.component').then(
                        (module) => module.RequirementFormComponent,
                      ),
                  },
                  {
                    path: ':requirementId',
                    loadComponent: () =>
                      import('./features/requirements/requirement-detail/requirement-detail.component').then(
                        (module) => module.RequirementDetailComponent,
                      ),
                  },
                ],
              },
              {
                path: 'tasks',
                loadComponent: () =>
                  import('./features/tasks/task-board.component').then(
                    (module) => module.TaskBoardComponent,
                  ),
              },
              {
                path: 'issues',
                children: [
                  {
                    path: '',
                    pathMatch: 'full',
                    loadComponent: () =>
                      import('./features/issues/issue-list/issue-list.component').then(
                        (module) => module.IssueListComponent,
                      ),
                  },
                  {
                    path: ':issueId',
                    loadComponent: () =>
                      import('./features/issues/issue-detail/issue-detail.component').then(
                        (module) => module.IssueDetailComponent,
                      ),
                  },
                ],
              },
              {
                path: 'files',
                data: {
                  title: 'Files',
                  icon: 'folder_shared',
                  description: 'Shared project files and deliverables will appear here.',
                },
                loadComponent: () =>
                  import('./shared/components/placeholder-page/placeholder-page.component').then(
                    (module) => module.PlaceholderPageComponent,
                  ),
              },
              {
                path: 'discussion',
                data: {
                  title: 'Discussion',
                  icon: 'forum',
                  description: 'Project conversations and comment threads.',
                },
                loadComponent: () =>
                  import('./features/communication/project-discussion.component').then(
                    (module) => module.ProjectDiscussionComponent,
                  ),
              },
              {
                path: 'reports',
                data: {
                  title: 'Reports',
                  icon: 'insights',
                  description: 'Delivery reports and client summaries will be added later.',
                },
                loadComponent: () =>
                  import('./shared/components/placeholder-page/placeholder-page.component').then(
                    (module) => module.PlaceholderPageComponent,
                  ),
              },
            ],
          },
        ],
      },
      {
        path: 'requirements',
        data: {
          title: 'Requirements',
          icon: 'assignment',
        },
        loadComponent: () =>
          import('./features/requirements/requirement-workspace/requirement-workspace.component').then(
            (module) => module.RequirementWorkspaceComponent,
          ),
      },
      {
        path: 'tasks',
        data: {
          title: 'Tasks',
          icon: 'task_alt',
          description: 'Browse the tasks assigned to you and log your progress.',
        },
        loadComponent: () =>
          import('./features/tasks/global-tasks.component').then(
            (module) => module.GlobalTasksComponent,
          ),
      },
      {
        path: 'issues',
        data: {
          title: 'Issues',
          icon: 'bug_report',
          description: 'Follow every issue across the projects you can access.',
        },
        loadComponent: () =>
          import('./features/issues/global-issues.component').then(
            (module) => module.GlobalIssuesComponent,
          ),
      },
      {
        path: 'files',
        data: {
          title: 'Files',
          icon: 'folder_shared',
          description: 'Shared project documents, attachments and deliverables.',
        },
        loadComponent: () =>
          import('./shared/components/placeholder-page/placeholder-page.component').then(
            (module) => module.PlaceholderPageComponent,
          ),
      },
      {
        path: 'notifications',
        data: {
          title: 'Notifications',
          icon: 'notifications',
          description: 'Assignments, mentions, reviews, and reminders.',
        },
        loadComponent: () =>
          import('./features/notifications/notifications.component').then(
            (module) => module.NotificationsComponent,
          ),
      },
      {
        path: 'profile',
        data: {
          title: 'Profile',
          icon: 'settings',
          description: 'Update your name and email notification preferences.',
        },
        loadComponent: () =>
          import('./features/profile/profile.component').then(
            (module) => module.ProfileComponent,
          ),
      },
      {
        path: 'communication',
        data: {
          title: 'Messages',
          icon: 'forum',
          description: 'Project discussions and comment threads in one place.',
        },
        loadComponent: () =>
          import('./shared/components/placeholder-page/placeholder-page.component').then(
            (module) => module.PlaceholderPageComponent,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
