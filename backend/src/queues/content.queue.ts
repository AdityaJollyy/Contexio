import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { env } from '../config/env.js';

export const CONTENT_QUEUE_NAME = 'content-processing';

export interface ContentJobData {
  contentId: string;
}

export const contentQueue = new Queue<ContentJobData>(CONTENT_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: env.WORKER_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: env.WORKER_BACKOFF_MS },
    removeOnComplete: { count: 100 },
    // Failed jobs are the dead-letter queue. A week is long enough to debug
    // from, and bounds the only thing in Redis that would grow forever.
    removeOnFail: { age: 604800, count: 1000 },
  },
});

export const enqueueContent = async (contentId: string): Promise<void> => {
  // BullMQ retains completed job ids and silently ignores add() for one it
  // already knows, so re-processing an edited item requires removing it first.
  try {
    await contentQueue.remove(contentId);
  } catch {
    // No existing job, or it is active. Either is fine.
  }

  await contentQueue.add(
    'process',
    { contentId },
    { jobId: contentId } // idempotency: same content = one job, never duplicated
  );
};
