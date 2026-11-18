import { app } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';
import { startNotificationJobs } from './jobs/notification.job';
import { startProjectHealthJobs } from './jobs/projectHealth.job';

async function startServer(): Promise<void> {
  try {
    await connectDatabase();
    startNotificationJobs();
    startProjectHealthJobs();

    const server = app.listen(env.PORT);
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    console.log(`Server listening on http://localhost:${env.PORT}`);

    const shutdown = (signal: string): void => {
      console.log(`${signal} received, shutting down`);
      server.close(() => {
        void disconnectDatabase().finally(() => process.exit(0));
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'EADDRINUSE'
    ) {
      console.error(
        `Port ${env.PORT} is already in use. Stop the process using it or set PORT to another available port.`,
      );
      process.exit(1);
    }

    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void startServer();
