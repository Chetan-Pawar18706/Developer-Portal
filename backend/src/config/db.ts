import mongoose from 'mongoose';
import { env } from './env';

export async function connectDatabase(): Promise<void> {
  mongoose.connection.on('error', (error) => {
    console.error('MongoDB connection error:', error);
  });

  await mongoose.connect(env.MONGO_URI);
  console.log('MongoDB connected');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
