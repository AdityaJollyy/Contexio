/**
 * Re-queues every item the worker gave up on, across all users.
 *
 * Usage:
 *   npm run retry-failed
 *
 * For the correlated case, where a quota-exhausted afternoon fails a dozen items
 * at once. Not scheduled: BullMQ already retries with backoff, and a nightly
 * sweep would re-spend quota on items that will never succeed.
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Content } from '../models/content.model.js';
import { enqueueContent } from '../queues/content.queue.js';
import { redisConnection } from '../config/redis.js';
import { getErrorMessage } from '../lib/errors.js';

const retryFailed = async (): Promise<void> => {
  await mongoose.connect(env.DATABASE_URL);
  console.log('Connected to MongoDB');

  const items = await Content.find({ status: 'failed' }).select('_id title failureReason').lean();
  console.log(`Found ${items.length} failed item(s)`);

  let queued = 0;
  let failed = 0;

  for (const [index, item] of items.entries()) {
    const id = item._id.toString();
    try {
      await Content.updateOne(
        { _id: item._id },
        { $set: { status: 'pending', failureReason: '' } }
      );
      await enqueueContent(id);
      queued += 1;
      console.log(
        `[${index + 1}/${items.length}] queued "${item.title || id}" (${item.failureReason})`
      );
    } catch (error) {
      failed += 1;
      console.error(
        `[${index + 1}/${items.length}] could not queue "${item.title || id}":`,
        getErrorMessage(error)
      );
    }
  }

  console.log(`Done. Queued: ${queued}, could not queue: ${failed}`);

  await mongoose.disconnect();
  await redisConnection.quit();
  process.exit(failed > 0 ? 1 : 0);
};

retryFailed().catch((error) => {
  console.error('Retry-failed crashed:', getErrorMessage(error));
  process.exit(1);
});
