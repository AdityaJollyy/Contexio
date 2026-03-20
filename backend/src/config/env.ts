import { z } from 'zod';
import dotenv from 'dotenv';

// Load the .env file
dotenv.config();

// Define the exact shape our environment variables MUST take
const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.url({ message: 'DATABASE_URL must be a valid URL' }),
  JWT_SECRET: z.string().min(10, { message: 'JWT_SECRET must be at least 10 characters long' }),
  GEMINI_API_KEY: z.string().min(1, { message: 'GEMINI_API_KEY is required' }),
});

// Parse and validate the environment variables
const envParse = envSchema.safeParse(process.env);

if (!envParse.success) {
  console.error('Invalid environment variables:', envParse.error);
  process.exit(1); // Crash the app immediately if variables are missing
}

export const env = envParse.data;
