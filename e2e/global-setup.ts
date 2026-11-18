import { execSync } from 'node:child_process';
import path from 'node:path';

export default async function globalSetup(): Promise<void> {
  const rootDir = path.resolve(__dirname, '..');
  const backendDir = path.join(rootDir, 'backend');

  execSync('npm run seed', {
    cwd: backendDir,
    env: {
      ...process.env,
      MONGO_URI: process.env['E2E_MONGO_URI'] ?? 'mongodb://127.0.0.1:27017/devportal-e2e',
    },
    stdio: 'inherit',
  });
}
