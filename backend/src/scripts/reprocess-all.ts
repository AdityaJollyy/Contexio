/**
 * Re-indexes every saved item. Use after a prompt or chunking change.
 *
 * Usage:
 *   npm run reprocess
 *
 * Only resets status and re-queues. The worker does the work, so the rate
 * limiter and retry policy apply as they do to a normal save.
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Content } from '../models/content.model.js';
import { enqueueContent } from '../queues/content.queue.js';
import { redisConnection } from '../config/redis.js';
import { getErrorMessage } from '../lib/errors.js';

const reprocessAll = async (): Promise<void> => {
  await mongoose.connect(env.DATABASE_URL);
  console.log('Connected to MongoDB');

  const items = await Content.find({}).select('_id title').lean();
  console.log(`Found ${items.length} item(s) to re-queue`);

  let queued = 0;
  let failed = 0;

  for (const [index, item] of items.entries()) {
    const id = item._id.toString();
    try {
      await Content.updateOne({ _id: item._id }, { $set: { status: 'pending' } });
      await enqueueContent(id);
      queued += 1;
      console.log(`[${index + 1}/${items.length}] queued "${item.title || id}"`);
    } catch (error) {
      failed += 1;
      console.error(
        `[${index + 1}/${items.length}] failed "${item.title || id}":`,
        getErrorMessage(error)
      );
    }
  }

  console.log(`Done. Queued: ${queued}, failed: ${failed}`);

  await mongoose.disconnect();
  await redisConnection.quit();
  process.exit(failed > 0 ? 1 : 0);
};

reprocessAll().catch((error) => {
  console.error('Reprocess failed:', getErrorMessage(error));
  process.exit(1);
});
