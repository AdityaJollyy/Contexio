import { Content } from '../models/content.model.js';
import { scrapeMetadata } from './scraper.service.js';
import { generateSummary, generateEmbedding } from './ai.service.js';

const MAX_RETRIES = 5;

/**
 * Processes a single item from the queue
 */
const processNextItem = async (): Promise<void> => {
  // Find ONE document that is 'pending' or 'retrying'.
  // Because we added an index to 'status', this query is now lightning fast!
  const item = await Content.findOneAndUpdate(
    { status: { $in: ['pending', 'retrying'] } },
    { status: 'processing' }, // Lock it immediately so other workers don't grab the same item
    { returnDocument: 'after' }
  );

  if (!item) return; // Queue is empty

  try {
    console.log(`⏳ Processing content: ${item._id}`);

    let metadata = '';
    let aiSummary = '';

    // Step 1 & 2: If it's a link, scrape it and summarize it
    if (item.type !== 'text' && item.type !== 'others' && item.link) {
      metadata = await scrapeMetadata(item.link, item.type);
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

    // Step 5: Save everything back to the database safely
    await Content.updateOne(
      { _id: item._id },
      {
        $set: {
          metadata,
          aiSummary,
          embedding,
          status: 'ready', // Success!
        },
      }
    );

    console.log(`✅ Successfully processed: ${item._id}`);
  } catch (error) {
    console.error(`❌ Failed to process content ${item._id}:`, (error as Error).message);

    const nextRetryCount = item.retryCount + 1;
    const nextStatus = nextRetryCount >= MAX_RETRIES ? 'failed' : 'retrying';

    // Release the lock and increment the retry count
    await Content.updateOne(
      { _id: item._id },
      {
        $set: {
          status: nextStatus,
          retryCount: nextRetryCount,
        },
      }
    );
  }
};

/**
 * Starts the infinite background loop to poll the database
 */
export const startBackgroundWorker = async () => {
  console.log('⚙️ Background Worker started. Polling database...');

  // On startup, rescue any items that were mid-processing when the server last crashed
  // These are stuck in 'processing' status and will never self-recover otherwise
  const stuckCount = await Content.countDocuments({ status: 'processing' });
  if (stuckCount > 0) {
    await Content.updateMany({ status: 'processing' }, { $set: { status: 'retrying' } });
    console.log(`♻️ Recovered ${stuckCount} stuck item(s) from 'processing' back to 'retrying'`);
  }

  // Every 5 seconds, attempt to process a job from the queue
  setInterval(async () => {
    try {
      await processNextItem();
    } catch (error) {
      console.error('Worker loop encountered an error:', error);
    }
  }, 5000);
};
