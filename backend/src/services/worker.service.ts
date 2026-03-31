import { Content } from '../models/content.model.js';
import { scrapeMetadata } from './scraper.service.js';
import { generateSummary, generateEmbedding } from './ai.service.js';
import { getErrorMessage } from '../lib/errors.js';
import { Types } from 'mongoose';

const MAX_RETRIES = 5;

/**
 * Process a single content item by ID
 * This function is called as fire-and-forget after content create/update operations
 */
export const processItem = async (contentId: string | Types.ObjectId): Promise<void> => {
  try {
    // Fetch the item
    const item = await Content.findById(contentId);
    if (!item) {
      console.error(`Content not found: ${contentId}`);
      return;
    }

    // Set status to processing and record start time
    item.status = 'processing';
    await item.save();

    console.log(`Processing content: ${item._id}`);

    let metadata = '';
    let aiSummary = '';

    // Step 1 & 2: If it's a link, try to scrape it and summarize it
    if (item.type !== 'text' && item.link) {
      try {
        metadata = await scrapeMetadata(item.link);
        if (metadata) {
          aiSummary = await generateSummary(metadata);
        }
      } catch (scrapeError) {
        console.error(`Scraping failed for ${item._id}, continuing with title/description only:`, getErrorMessage(scrapeError));
        // metadata and aiSummary remain empty, embedding will use title + description
      }
    }

    // Step 3: Combine all text to create the semantic embedding
    const combinedTextToEmbed = [item.title, item.description, metadata, aiSummary]
      .filter(Boolean)
      .join(' ')
      .trim()
      .slice(0, 8000);

    // Step 4: Generate the Vector Embedding (always generate if we have at least a title)
    let embedding: number[] | undefined = undefined;
    if (combinedTextToEmbed) {
      embedding = await generateEmbedding(combinedTextToEmbed);
      item.embedding = embedding;
    }

    // Step 5: Save everything and set status to ready
    item.metadata = metadata;
    item.aiSummary = aiSummary;
    item.status = 'ready';
    item.retryAfter = null;
    await item.save();

    console.log(`Successfully processed: ${item._id}`);
  } catch (error) {
    console.error(`Failed to process content ${contentId}:`, getErrorMessage(error));

    // On failure: increment retryCount, calculate retryAfter, update status
    try {
      const item = await Content.findById(contentId);
      if (!item) return;

      const nextRetryCount = item.retryCount + 1;
      const nextStatus = nextRetryCount >= MAX_RETRIES ? 'failed' : 'retrying';

      // Calculate exponential backoff: 2^retryCount * 5000ms
      const delayMs = Math.pow(2, nextRetryCount) * 5000;
      const retryAfter = new Date(Date.now() + delayMs);

      item.status = nextStatus;
      item.retryCount = nextRetryCount;
      item.retryAfter = nextStatus === 'retrying' ? retryAfter : null;
      await item.save();

      console.log(
        `Content ${item._id} will ${nextStatus === 'retrying' ? `retry after ${delayMs}ms` : 'not retry (failed)'}`
      );

      // Schedule retry if not failed
      if (nextStatus === 'retrying') {
        setTimeout(() => {
          processItem(contentId).catch((err) => {
            console.error(`Retry failed for ${contentId}:`, getErrorMessage(err));
          });
        }, delayMs);
      }
    } catch (saveError) {
      console.error(`Failed to update retry status for ${contentId}:`, getErrorMessage(saveError));
    }
  }
};

/**
 * One-time startup sweep to process all pending/stuck items
 * - Items with status = pending or processing (stuck from crash)
 * - Items with status = retrying AND retryAfter <= now
 */
export const startupSweep = async (): Promise<void> => {
  console.log('Running startup sweep for pending/stuck items...');

  try {
    // Reset stuck items (processing status means server crashed mid-job)
    const stuckItems = await Content.find({ status: 'processing' });
    for (const item of stuckItems) {
      console.log(`Resetting stuck item ${item._id} to pending`);
      item.status = 'pending';
      item.retryAfter = null;
      await item.save();
    }

    // Find all items that need processing
    const now = new Date();
    const itemsToProcess = await Content.find({
      $or: [
        { status: 'pending' },
        {
          status: 'retrying',
          $or: [{ retryAfter: { $lte: now } }, { retryAfter: null }],
        },
      ],
    }).select('_id');

    console.log(`Found ${itemsToProcess.length} item(s) to process on startup`);

    // Process each item (fire-and-forget)
    for (const item of itemsToProcess) {
      processItem(item._id).catch((err) => {
        console.error(`Startup processing failed for ${item._id}:`, getErrorMessage(err));
      });
    }

    // Find retrying items whose retryAfter is still in the future
    const futureRetries = await Content.find({
      status: 'retrying',
      retryAfter: { $gt: now },
    }).select('_id retryAfter');

    console.log(`Rescheduling ${futureRetries.length} future retry item(s)`);

    for (const item of futureRetries) {
      const delay = item.retryAfter!.getTime() - Date.now();
      setTimeout(() => {
        processItem(item._id).catch(console.error);
      }, delay);
    }
  } catch (error) {
    console.error('Startup sweep error:', getErrorMessage(error));
  }
};
