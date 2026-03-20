import mongoose from 'mongoose';
import { env } from './env.js';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.DATABASE_URL);
    console.log(`MongoDB Connected successfully`);
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1); // Crash if DB connection fails
  }
};
