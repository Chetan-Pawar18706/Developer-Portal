import os from 'os';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let memoryServer: MongoMemoryServer | undefined;

export async function startTestDatabase(): Promise<void> {
  memoryServer = await MongoMemoryServer.create({
    binary: {
      version: '7.0.14',
    },
    instance: {
      launchTimeout: 60_000,
    },
  });

  await mongoose.connect(memoryServer.getUri(), {
    runtimeAdapters: { os },
  });
}

export async function stopTestDatabase(): Promise<void> {
  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}

export async function clearTestDatabase(): Promise<void> {
  await mongoose.connection.db?.dropDatabase();
}
