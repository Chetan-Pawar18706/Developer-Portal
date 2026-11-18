export interface ReportQuery {
  projectId?: string;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface ProjectReportRow {
  id: string;
  title: string;
  status: string;
  health: string;
  totalRequirements: number;
  totalTasks: number;
  doneTasks: number;
  totalIssues: number;
  openIssues: number;
  overdueTasks: number;
  hoursLogged: number;
  progress: number;
}

export interface PortfolioReport {
  generatedAt: string;
  totals: {
    projects: number;
    requirements: number;
    tasks: number;
    doneTasks: number;
    blockedTasks: number;
    overdueTasks: number;
    issues: number;
    openIssues: number;
    files: number;
    hoursLogged: number;
    completion: number;
  };
  taskStatuses: StatusCount[];
  requirementStatuses: StatusCount[];
  issueStatuses: StatusCount[];
  projects: ProjectReportRow[];
}
