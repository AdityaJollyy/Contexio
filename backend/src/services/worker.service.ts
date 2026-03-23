import { Content } from '../models/content.model.js';
import { scrapeMetadata } from './scraper.service.js';
import { generateSummary, generateEmbedding } from './ai.service.js';
import { getErrorMessage } from '../lib/errors.js';

const MAX_RETRIES = 5;
const STUCK_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Processes a single item from the queue
 */
const processNextItem = async (): Promise<void> => {
  // Atomically find and lock one pending/retrying item
  const item = await Content.findOneAndUpdate(
    { status: { $in: ['pending', 'retrying'] } },
    {
      status: 'processing',
      processingStartedAt: new Date(),
    },
    { returnDocument: 'after', sort: { createdAt: 1 } }
  );

  if (!item) return; // Queue is empty

  try {
    console.log(`Processing content: ${item._id}`);

    let metadata = '';
    let aiSummary = '';

    // Step 1 & 2: If it's a link, scrape it and summarize it
    if (item.type !== 'text' && item.type !== 'others' && item.link) {
      metadata = await scrapeMetadata(item.link);
      if (metadata) {
        aiSummary = await generateSummary(metadata);
      }
    }

    // Step 3: Combine all text to create the semantic embedding
    const combinedTextToEmbed = `${item.title} ${item.description || ''} ${metadata} ${aiSummary}`
      .trim()
      .slice(0, 8000);

    // Step 4: Generate the Vector Embedding
    let embedding: number[] | undefined = undefined;
    if (combinedTextToEmbed) {
      embedding = await generateEmbedding(combinedTextToEmbed);
    }

    // Step 5: Save everything back to the database
    await Content.updateOne(
      { _id: item._id },
      {
        $set: {
          metadata,
          aiSummary,
          embedding,
          status: 'ready',
          processingStartedAt: undefined,
        },
      }
    );

    console.log(`Successfully processed: ${item._id}`);
  } catch (error) {
    console.error(`Failed to process content ${item._id}:`, getErrorMessage(error));

    const nextRetryCount = item.retryCount + 1;
    const nextStatus = nextRetryCount >= MAX_RETRIES ? 'failed' : 'retrying';

    await Content.updateOne(
      { _id: item._id },
      {
        $set: {
          status: nextStatus,
          retryCount: nextRetryCount,
          processingStartedAt: undefined,
        },
      }
    );
  }
};

/**
 * Recovers items stuck in 'processing' state for too long
 */
const recoverStuckItems = async (): Promise<void> => {
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

  // Only recover items that have been processing for > 2 minutes
  const result = await Content.updateMany(
    {
      status: 'processing',
      processingStartedAt: { $lt: stuckThreshold },
    },
    { $set: { status: 'retrying' }, $unset: { processingStartedAt: '' } }
  );

  if (result.modifiedCount > 0) {
    console.log(`Recovered ${result.modifiedCount} stuck item(s)`);
  }
};

/**
 * Starts the background worker loop
 */
export const startBackgroundWorker = async () => {
  console.log('Background Worker started');

  // Recover truly stuck items on startup (processing for > 2 minutes)
  await recoverStuckItems();

  // Process jobs every 5 seconds
  setInterval(async () => {
    try {
      await processNextItem();
    } catch (error) {
      console.error('Worker loop error:', getErrorMessage(error));
    }
  }, 5000);

  // Periodically recover stuck items (every 30 seconds)
  setInterval(async () => {
    try {
      await recoverStuckItems();
    } catch (error) {
      console.error('Recovery loop error:', getErrorMessage(error));
    }
  }, 30000);
};
