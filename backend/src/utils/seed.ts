import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/db';

async function seed(): Promise<void> {
  try {
    await connectDatabase();

    const models = Object.values(mongoose.models);
    await Promise.all(models.map((model) => model.syncIndexes()));

    console.log(
      `Seed completed: synchronized indexes for ${models.length} model(s).`,
    );
  } catch (error) {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

void seed();
