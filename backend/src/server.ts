import { app } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    const server = app.listen(env.PORT, () => {
      console.log(`Server listening on http://localhost:${env.PORT}`);
    });

    const shutdown = (signal: string): void => {
      console.log(`${signal} received, shutting down`);
      server.close(() => {
        void disconnectDatabase().finally(() => process.exit(0));
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

void startServer();
