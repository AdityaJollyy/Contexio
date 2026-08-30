import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Worker } from 'bullmq';
import { redisConnection } from './config/redis.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { CONTENT_QUEUE_NAME, type ContentJobData } from './queues/content.queue.js';
import { processContent } from './services/worker.service.js';
import { getErrorMessage } from './lib/errors.js';
import { Content } from './models/content.model.js';

/** The one sentence shown on the card. The real error is still logged in full. */
const userFacingReason = (error: unknown): string => {
  const message = getErrorMessage(error);

  if (/429|quota|RESOURCE_EXHAUSTED|rate limit/i.test(message)) {
    return 'The AI service was busy.';
  }
  if (
    /timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(message)
  ) {
    return "We couldn't reach that page.";
  }
  return 'Something went wrong.';
};

export const startWorker = async (): Promise<Worker<ContentJobData>> => {
  const worker = new Worker<ContentJobData>(
    CONTENT_QUEUE_NAME,
    async (job) => {
      // On the last attempt a transient failure degrades rather than throwing,
      // so an item that saved successfully never ends up marked failed.
      const attempts = job.opts.attempts ?? 1;
      await processContent(job.data.contentId, job.attemptsMade >= attempts - 1);
    },
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY,
      limiter: {
        max: env.WORKER_RATE_LIMIT_MAX,
        duration: env.WORKER_RATE_LIMIT_DURATION_MS,
      },
    }
  );

  worker.on('failed', async (job, error) => {
    console.error(`Job ${job?.id} failed:`, getErrorMessage(error));

    // Mark the document failed only once all attempts are exhausted.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      try {
        await Content.findByIdAndUpdate(job.data.contentId, {
          status: 'failed',
          failureReason: userFacingReason(error),
        });
      } catch (updateError) {
        console.error(`Could not mark ${job.data.contentId} failed:`, getErrorMessage(updateError));
      }
    }
  });

  return worker;
};

// Runs only when this file is the process entry point; index.ts imports
// startWorker directly for the single-process mode.
const isEntryPoint =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntryPoint) {
  const bootstrap = async (): Promise<void> => {
    await connectDB();
    const worker = await startWorker();
    console.log(`Worker started, listening on queue "${CONTENT_QUEUE_NAME}"`);

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`${signal} received, shutting the worker down...`);
      // Lets the in-flight job finish, or returns it to the queue.
      await worker.close();
      await mongoose.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
  };

  bootstrap().catch((error) => {
    console.error('Failed to start the worker:', getErrorMessage(error));
    process.exit(1);
  });
}
