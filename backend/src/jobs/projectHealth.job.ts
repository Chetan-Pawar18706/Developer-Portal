import cron, { type ScheduledTask } from 'node-cron';
import { env } from '../config/env';
import { refreshAllProjectHealth } from '../services/projectHealth.service';

let scheduledJob: ScheduledTask | null = null;

export function startProjectHealthJobs(): ScheduledTask | null {
  if (env.NODE_ENV === 'test' || scheduledJob) {
    return null;
  }

  scheduledJob = cron.schedule(
    '10 0 * * *',
    () => {
      void refreshAllProjectHealth().catch((error: unknown) => {
        console.error('Unable to refresh project health:', error);
      });
    },
    { scheduled: true, timezone: 'UTC' },
  );

  return scheduledJob;
}
