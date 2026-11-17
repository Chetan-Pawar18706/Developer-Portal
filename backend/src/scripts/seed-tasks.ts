import { connectDatabase, disconnectDatabase } from '../config/db';
import { env } from '../config/env';
import { seedDemoTasks } from './demo-tasks';

async function run(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed demo tasks: NODE_ENV is production.');
    process.exitCode = 1;
    return;
  }

  try {
    await connectDatabase();
    const result = await seedDemoTasks();
    console.log(
      `Demo tasks ready: ${result.created} created, ${result.skipped} already present across ${result.projects} projects.`,
    );
  } catch (error) {
    console.error('Demo task seed failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void run();
