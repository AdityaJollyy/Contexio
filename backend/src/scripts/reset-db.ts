/**
 * Empties the database and the job queue.
 *
 * Usage:
 *   npm run reset-db              # report what would be deleted, change nothing
 *   npm run reset-db -- --confirm # delete it
 *
 * Atlas search indexes are left alone. They are correct, they hold no data,
 * and recreating them is manual work.
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { Content } from '../models/content.model.js';
import { Chunk } from '../models/chunk.model.js';
import { contentQueue } from '../queues/content.queue.js';
import { redisConnection } from '../config/redis.js';
import { getErrorMessage } from '../lib/errors.js';

const resetDb = async (): Promise<void> => {
  const confirmed = process.argv.includes('--confirm');

  await mongoose.connect(env.DATABASE_URL);

  const counts = {
    users: await User.countDocuments(),
    contents: await Content.countDocuments(),
    chunks: await Chunk.countDocuments(),
  };
  const jobs = await contentQueue.getJobCounts();

  console.log(`Database: ${mongoose.connection.name}`);
  console.log(`  users     ${counts.users}`);
  console.log(`  contents  ${counts.contents}`);
  console.log(`  chunks    ${counts.chunks}`);
  console.log(`  queue     ${JSON.stringify(jobs)}`);

  if (!confirmed) {
    console.log('\nDry run. Re-run with --confirm to delete all of the above.');
  } else {
    await Chunk.deleteMany({});
    await Content.deleteMany({});
    await User.deleteMany({});
    // Drains every state at once, including jobs a plain drain() leaves behind.
    await contentQueue.obliterate({ force: true });
    console.log('\nDeleted. Search indexes were not touched.');
  }

  await mongoose.disconnect();
  await redisConnection.quit();
  process.exit(0);
};

resetDb().catch((error) => {
  console.error('Reset failed:', getErrorMessage(error));
  process.exit(1);
});
