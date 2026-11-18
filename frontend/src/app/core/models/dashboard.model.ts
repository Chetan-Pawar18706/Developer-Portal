import type { UserRole } from './user.model';

export interface DashboardCountItem {
  key: string;
  count: number;
}

export interface DashboardActivity {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardDeadline {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  assignee: string | null;
}

export interface DashboardOverdueTask {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  assignee: string | null;
}

export interface DashboardWorkload {
  developerId: string;
  developerName: string;
  openTasks: number;
  estimatedHours: number;
  loggedHours: number;
}

export interface DashboardBurnDownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

export interface ProjectDashboard {
  projectId: string;
  generatedAt: string;
  health: string;
  tasks: {
    total: number;
    byStatus: DashboardCountItem[];
    completionPercent: number;
    overdue: number;
    hoursLogged: number;
    hoursEstimated: number;
  };
  issues: {
    openBySeverity: DashboardCountItem[];
  };
  deadlines: DashboardDeadline[];
  pendingApprovals: {
    total: number;
    requirements: number;
    tasks: number;
  };
  activities: DashboardActivity[];
}

export interface PmDashboard {
  projectId: string;
  generatedAt: string;
  workload: DashboardWorkload[];
  burnDown: DashboardBurnDownPoint[];
  overdueTasks: DashboardOverdueTask[];
  issueAging: DashboardCountItem[];
}

export interface DashboardProjectRow {
  id: string;
  title: string;
  status: string;
  health: string;
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  openIssues: number;
  completionPercent: number;
}

export interface AdminDashboard {
  role: 'admin';
  generatedAt: string;
  totals: {
    projects: number;
    tasks: number;
    issues: number;
    requirements: number;
    files: number;
    activeUsers: number;
  };
  projects: DashboardProjectRow[];
}

export interface MeDashboard {
  role: UserRole;
  generatedAt: string;
  projects: DashboardProjectRow[];
  metrics: {
    visibleProjects: number;
    openTasks: number;
    overdueTasks: number;
    openIssues: number;
    pendingApprovals: number;
  };
}
