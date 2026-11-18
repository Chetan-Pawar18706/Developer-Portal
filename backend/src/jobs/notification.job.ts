import cron, { type ScheduledTask } from 'node-cron';
import {
  Project,
  type ProjectMemberAttributes,
} from '../models/project.model';
import { Task, type TaskDocument } from '../models/task.model';
import { env } from '../config/env';
import { notify } from '../services/notification.service';

const DAY_MS = 24 * 60 * 60 * 1000;
let scheduledJob: ScheduledTask | null = null;

function recipientIdsForTask(
  task: TaskDocument,
  projectMembers: readonly ProjectMemberAttributes[],
): string[] {
  if (task.assignee) {
    return [task.assignee.toString()];
  }

  return projectMembers
    .filter((member) => member.role === 'pm')
    .map((member) => member.user.toString());
}

export async function sendTaskDueReminders(now = new Date()): Promise<void> {
  const soon = new Date(now.getTime() + DAY_MS);
  const tasks = await Task.find({
    status: { $ne: 'done' },
    dueDate: { $ne: null, $lte: soon },
  }).select('project title assignee dueDate status');

  for (const task of tasks) {
    if (!task.dueDate) {
      continue;
    }

    const project = await Project.findById(task.project).select('title members client');

    if (!project) {
      continue;
    }

    const isOverdue = new Date(task.dueDate).getTime() < now.getTime();
    const recipients = recipientIdsForTask(task, project.members);

    if (recipients.length === 0) {
      continue;
    }

    await notify(recipients, {
      projectId: project._id.toString(),
      type: isOverdue ? 'task_overdue' : 'task_due_reminder',
      message: isOverdue
        ? `Task "${task.title}" is overdue.`
        : `Task "${task.title}" is due within 24 hours.`,
      link: `/projects/${project._id.toString()}/tasks`,
    });
  }
}

export function startNotificationJobs(): ScheduledTask | null {
  if (env.NODE_ENV === 'test' || scheduledJob) {
    return null;
  }

  scheduledJob = cron.schedule(
    '0 8 * * *',
    () => {
      void sendTaskDueReminders().catch((error: unknown) => {
        console.error('Unable to send task due reminders:', error);
      });
    },
    { scheduled: true, timezone: 'UTC' },
  );

  return scheduledJob;
}
