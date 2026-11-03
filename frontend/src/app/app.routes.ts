import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
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
        data: {
          title: 'Projects',
          icon: 'folder_open',
          description: 'Create projects, track milestones and review delivery progress.',
        },
        loadComponent: () =>
          import('./shared/components/placeholder-page/placeholder-page.component').then(
            (module) => module.PlaceholderPageComponent,
          ),
      },
      {
        path: 'requirements',
        data: {
          title: 'Requirements',
          icon: 'assignment',
          description: 'Capture project requirements and follow them through approval.',
        },
        loadComponent: () =>
          import('./shared/components/placeholder-page/placeholder-page.component').then(
            (module) => module.PlaceholderPageComponent,
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
          import('./shared/components/placeholder-page/placeholder-page.component').then(
            (module) => module.PlaceholderPageComponent,
          ),
      },
      {
        path: 'issues',
        data: {
          title: 'Issues',
          icon: 'bug_report',
          description: 'Raise and track the issues that are blocking delivery.',
        },
        loadComponent: () =>
          import('./shared/components/placeholder-page/placeholder-page.component').then(
            (module) => module.PlaceholderPageComponent,
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
