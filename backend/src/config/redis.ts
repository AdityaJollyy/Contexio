import { Redis } from 'ioredis';
import { env } from './env.js';

// BullMQ requires maxRetriesPerRequest: null on its connection.
export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (error) => {
  console.error('Redis connection error:', error.message);
});
