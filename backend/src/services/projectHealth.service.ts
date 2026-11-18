import { Types } from 'mongoose';
import { Project, type ProjectHealth } from '../models/project.model';
import { Task } from '../models/task.model';

export interface HealthInput {
  totalTasks: number;
  doneTasks: number;
  overdueTasks: number;
  dueDate: Date | null;
  now?: Date;
}

interface TaskHealthAggregate {
  _id: null;
  total: number;
  done: number;
  overdue: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Health is driven by the overdue share of open work plus the delivery deadline:
 * a passed deadline or very high overdue ratio is Delayed, a near deadline with
 * low completion or a moderate overdue ratio is At risk, otherwise On track.
 */
export function calculateProjectHealth(input: HealthInput): ProjectHealth {
  const now = input.now ?? new Date();
  const openTasks = Math.max(0, input.totalTasks - input.doneTasks);
  const overdueRatio = openTasks === 0 ? 0 : input.overdueTasks / openTasks;
  const completion = input.totalTasks === 0 ? 100 : input.doneTasks / input.totalTasks;
  const daysToDue = input.dueDate
    ? Math.ceil((input.dueDate.getTime() - now.getTime()) / DAY_MS)
    : null;

  if (daysToDue !== null && daysToDue < 0 && completion < 1) {
    return 'off_track';
  }

  if (overdueRatio >= 0.3 || (daysToDue !== null && daysToDue <= 7 && completion < 0.6)) {
    return 'off_track';
  }

  if (overdueRatio >= 0.15 || (daysToDue !== null && daysToDue <= 14 && completion < 0.8)) {
    return 'at_risk';
  }

  return 'on_track';
}

export async function refreshProjectHealth(
  projectId: string | Types.ObjectId,
  now = new Date(),
): Promise<ProjectHealth | null> {
  const project = await Project.findById(projectId).select('dueDate health');

  if (!project) {
    return null;
  }

  const [result] = await Task.aggregate<TaskHealthAggregate>([
    { $match: { project: project._id } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$dueDate', null] },
                  { $lt: ['$dueDate', now] },
                  { $ne: ['$status', 'done'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const health = calculateProjectHealth({
    totalTasks: result?.total ?? 0,
    doneTasks: result?.done ?? 0,
    overdueTasks: result?.overdue ?? 0,
    dueDate: project.dueDate,
    now,
  });

  if (project.health !== health) {
    project.health = health;
    await project.save();
  }

  return health;
}

export async function refreshAllProjectHealth(now = new Date()): Promise<number> {
  const projects = await Project.find().select('_id');
  let updated = 0;

  for (const project of projects) {
    const health = await refreshProjectHealth(project._id, now);

    if (health) {
      updated += 1;
    }
  }

  return updated;
}

/** Health updates are background maintenance and must never fail a task operation. */
export async function refreshHealthSafely(projectId: Types.ObjectId): Promise<void> {
  try {
    await refreshProjectHealth(projectId);
  } catch (error) {
    console.error('Unable to refresh project health:', error);
  }
}
