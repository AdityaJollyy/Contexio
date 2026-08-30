import { Content } from '../models/content.model.js';
import { Chunk } from '../models/chunk.model.js';
import { scrapeMetadata } from './scraper.service.js';
import { enrichContent, generateEmbeddings } from './ai.service.js';
import { chunkText } from '../lib/chunk.js';
import { env } from '../config/env.js';

/**
 * Extract, enrich, chunk, embed, index. Errors are not caught here: BullMQ owns
 * retry and backoff, and swallowing one would strand the item in 'processing'.
 */
export const processContent = async (contentId: string, finalAttempt = true): Promise<void> => {
  const item = await Content.findById(contentId);
  if (!item) {
    // Deleted while queued. Returning cleanly stops BullMQ retrying a ghost.
    console.warn(`Content not found, skipping job: ${contentId}`);
    return;
  }

  item.status = 'processing';
  await item.save();

  console.log(`Processing content: ${item._id}`);

  const extracted =
    item.type !== 'text' && item.link
      ? await scrapeMetadata(item.link, finalAttempt)
      : { text: '', partial: false };
  const metadata = extracted.text;

  const { summary, topics } = await enrichContent(
    item.title,
    item.link,
    item.description,
    metadata
  );

  // Chunk 0 is always present, so a bare note or an unreadable page still has
  // one vector built from the owner's words. It matches most recall queries.
  const identityChunk = [
    `TITLE: ${item.title}`,
    `NOTES: ${item.description}`,
    `SUMMARY: ${summary}`,
    `TOPICS: ${topics.join(', ')}`,
  ].join('\n');

  const bodyChunks = metadata ? chunkText(metadata, env.CHUNK_SIZE, env.CHUNK_OVERLAP) : [];
  const chunks = [identityChunk, ...bodyChunks].slice(0, env.MAX_CHUNKS_PER_ITEM);

  const embeddings = await generateEmbeddings(chunks, 'RETRIEVAL_DOCUMENT');

  // Delete-then-insert is what makes reprocessing idempotent.
  await Chunk.deleteMany({ contentId: item._id });
  await Chunk.insertMany(
    embeddings.map((embedding, chunkIndex) => ({
      userId: item.userId,
      contentId: item._id,
      chunkIndex,
      text: chunks[chunkIndex],
      embedding,
    }))
  );

  item.metadata = metadata;
  item.partial = extracted.partial;
  item.aiSummary = summary;
  item.topics = topics;
  item.status = 'ready';
  await item.save();

  console.log(`Successfully processed: ${item._id} (${embeddings.length} chunk(s))`);
};
