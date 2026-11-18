import { Issue } from '../models/issue.model';
import { Project } from '../models/project.model';
import { Requirement } from '../models/requirement.model';
import { Task } from '../models/task.model';
import type { UserDocument } from '../models/user.model';
import { createUser } from '../tests/factories';
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from '../tests/test-db';
import { getMeDashboard, getProjectDashboard, getProjectPmDashboard } from './dashboard.service';
import { calculateProjectHealth } from './projectHealth.service';

const DAY_MS = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase();
});

afterEach(async () => {
  await clearTestDatabase();
});

async function seedProject(): Promise<{
  project: InstanceType<typeof Project>;
  client: UserDocument;
  pm: UserDocument;
  developer: UserDocument;
}> {
  const client = await createUser({ email: 'dash-client@example.com', role: 'client' });
  const pm = await createUser({ email: 'dash-pm@example.com', role: 'pm' });
  const developer = await createUser({ email: 'dash-dev@example.com', role: 'developer' });
  const project = await Project.create({
    title: 'Dashboard project',
    description: 'Aggregation verification project.',
    client: client._id,
    members: [
      { user: client._id, role: 'client' },
      { user: pm._id, role: 'pm' },
      { user: developer._id, role: 'developer' },
    ],
    dueDate: new Date(Date.now() + 30 * DAY_MS),
  });

  return { project, client, pm, developer };
}

describe('dashboard aggregation numbers', () => {
  it('matches task, issue, hours and approval totals', async () => {
    const { project, pm, developer } = await seedProject();
    const now = new Date();

    await Task.create([
      {
        project: project._id,
        reporter: pm._id,
        title: 'Done task one',
        status: 'done',
        priority: 'medium',
        estimateHours: 4,
        dueDate: new Date(now.getTime() - 10 * DAY_MS),
        timeLogs: [{ user: developer._id, hours: 3, note: 'Work', date: now }],
      },
      {
        project: project._id,
        reporter: pm._id,
        title: 'Done task two',
        status: 'done',
        priority: 'low',
        estimateHours: 2,
        dueDate: new Date(now.getTime() - 8 * DAY_MS),
        timeLogs: [{ user: developer._id, hours: 5, note: 'Work', date: now }],
      },
      {
        project: project._id,
        reporter: pm._id,
        title: 'Overdue task',
        status: 'todo',
        priority: 'high',
        estimateHours: 6,
        dueDate: new Date(now.getTime() - DAY_MS),
      },
      {
        project: project._id,
        reporter: pm._id,
        title: 'In review task',
        status: 'in_review',
        priority: 'medium',
        estimateHours: 3,
        dueDate: new Date(now.getTime() + 3 * DAY_MS),
      },
    ]);

    await Issue.create([
      {
        project: project._id,
        title: 'High issue',
        description: 'Urgent',
        type: 'bug',
        severity: 'high',
        status: 'open',
        raisedBy: developer._id,
      },
      {
        project: project._id,
        title: 'Medium issue',
        description: 'Normal',
        type: 'question',
        severity: 'medium',
        status: 'in_progress',
        raisedBy: developer._id,
      },
      {
        project: project._id,
        title: 'Closed issue',
        description: 'Already fixed',
        type: 'bug',
        severity: 'critical',
        status: 'closed',
        raisedBy: developer._id,
      },
    ]);

    await Requirement.create({
      project: project._id,
      title: 'Awaiting review',
      description: 'Needs approval',
      priority: 'must',
      type: 'functional',
      status: 'submitted',
      createdBy: developer._id,
      versions: [
        {
          title: 'Awaiting review',
          description: 'Needs approval',
          editedBy: developer._id,
          editedAt: now,
        },
      ],
    });

    const dashboard = await getProjectDashboard(project.id);

    expect(dashboard.tasks.total).toBe(4);
    expect(dashboard.tasks.completionPercent).toBe(50);
    expect(dashboard.tasks.overdue).toBe(1);
    expect(dashboard.tasks.hoursLogged).toBe(8);
    expect(dashboard.tasks.hoursEstimated).toBe(15);
    expect(dashboard.issues.openBySeverity.find((item) => item.key === 'high')?.count).toBe(1);
    expect(dashboard.issues.openBySeverity.find((item) => item.key === 'medium')?.count).toBe(1);
    expect(dashboard.issues.openBySeverity.find((item) => item.key === 'critical')?.count).toBe(0);
    expect(dashboard.pendingApprovals.total).toBe(2);
    expect(dashboard.deadlines).toHaveLength(1);
  });

  it('returns PM workload and issue aging buckets', async () => {
    const { project, pm, developer } = await seedProject();

    await Task.create({
      project: project._id,
      reporter: pm._id,
      title: 'Developer task',
      status: 'in_progress',
      priority: 'high',
      estimateHours: 5,
      assignee: developer._id,
      dueDate: new Date(Date.now() - DAY_MS),
      timeLogs: [{ user: developer._id, hours: 2, note: 'Work', date: new Date() }],
    });

    await Issue.create({
      project: project._id,
      title: 'Aging issue',
      description: 'Old',
      type: 'bug',
      severity: 'low',
      status: 'open',
      raisedBy: developer._id,
      createdAt: new Date(Date.now() - 20 * DAY_MS),
    });

    const dashboard = await getProjectPmDashboard(project.id);

    expect(dashboard.workload).toHaveLength(1);
    expect(dashboard.workload[0]?.developerName).toBe(developer.name);
    expect(dashboard.workload[0]?.openTasks).toBe(1);
    expect(dashboard.workload[0]?.loggedHours).toBe(2);
    expect(dashboard.overdueTasks).toHaveLength(1);
    expect(dashboard.issueAging.find((item) => item.key === '15+')?.count).toBe(1);
    expect(dashboard.burnDown).toHaveLength(14);
  });

  it('builds a role-aware home summary', async () => {
    const { project, pm, developer } = await seedProject();

    await Task.create({
      project: project._id,
      reporter: pm._id,
      title: 'Open developer task',
      status: 'todo',
      priority: 'medium',
      estimateHours: 2,
      assignee: developer._id,
      dueDate: new Date(Date.now() - DAY_MS),
    });

    const developerSummary = await getMeDashboard({ id: developer.id, role: 'developer' });
    const pmSummary = await getMeDashboard({ id: pm.id, role: 'pm' });

    expect(developerSummary.metrics.visibleProjects).toBe(1);
    expect(developerSummary.metrics.openTasks).toBe(1);
    expect(developerSummary.metrics.overdueTasks).toBe(1);
    expect(pmSummary.metrics.openTasks).toBe(1);
    expect(pmSummary.projects).toHaveLength(1);
    expect(pmSummary.projects[0]?.title).toBe(project.title);
  });
});

describe('project health calculator', () => {
  it('labels delayed, at-risk and on-track projects', () => {
    const now = new Date();
    const dueDate = new Date(now.getTime() + 20 * DAY_MS);

    expect(
      calculateProjectHealth({
        totalTasks: 10,
        doneTasks: 8,
        overdueTasks: 0,
        dueDate,
        now,
      }),
    ).toBe('on_track');

    expect(
      calculateProjectHealth({
        totalTasks: 10,
        doneTasks: 5,
        overdueTasks: 1,
        dueDate,
        now,
      }),
    ).toBe('at_risk');

    expect(
      calculateProjectHealth({
        totalTasks: 10,
        doneTasks: 3,
        overdueTasks: 4,
        dueDate,
        now,
      }),
    ).toBe('off_track');

    expect(
      calculateProjectHealth({
        totalTasks: 10,
        doneTasks: 9,
        overdueTasks: 0,
        dueDate: new Date(now.getTime() - DAY_MS),
        now,
      }),
    ).toBe('off_track');
  });
});
