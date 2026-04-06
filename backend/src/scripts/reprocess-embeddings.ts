/**
 * Script to reprocess all content items with new embedding logic
 * This script processes items ONE BY ONE (sequentially) to avoid rate limits
 *
 * Usage:
 *   npx tsx src/scripts/reprocess-embeddings.ts
 *
 * The script will:
 * 1. Connect to MongoDB
 * 2. Fetch all content items
 * 3. Reprocess each item one by one (regenerate embeddings with boosted title/description)
 * 4. Show progress and summary at the end
 */

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Content } from '../models/content.model.js';
import { generateEmbedding } from '../services/ai.service.js';
import { getErrorMessage } from '../lib/errors.js';

// Delay between processing each item (in ms) to avoid rate limits
const DELAY_BETWEEN_ITEMS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const reprocessAllEmbeddings = async () => {
  console.log('='.repeat(60));
  console.log('EMBEDDING REPROCESSING SCRIPT');
  console.log('='.repeat(60));
  console.log('');

  // 1. Connect to MongoDB
  console.log('[1/4] Connecting to MongoDB...');
  try {
    await mongoose.connect(env.DATABASE_URL);
    console.log('      ✓ Connected successfully');
  } catch (error) {
    console.error('      ✗ Failed to connect:', getErrorMessage(error));
    process.exit(1);
  }

  // 2. Fetch all content items
  console.log('');
  console.log('[2/4] Fetching all content items...');
  const items = await Content.find({}).select('_id title description metadata aiSummary');
  console.log(`      ✓ Found ${items.length} items to reprocess`);

  if (items.length === 0) {
    console.log('');
    console.log('No items to process. Exiting.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // 3. Process each item one by one
  console.log('');
  console.log('[3/4] Reprocessing embeddings (one by one)...');
  console.log(`      Delay between items: ${DELAY_BETWEEN_ITEMS}ms`);
  console.log('');

  let successCount = 0;
  let failCount = 0;
  const failures: { id: string; title: string; error: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const progress = `[${i + 1}/${items.length}]`;

    try {
      // Build the new embedding text with boosted title/description
      const titleText = item.title ? `TITLE: ${item.title}` : '';
      const descriptionText = item.description ? `DESCRIPTION: ${item.description}` : '';

      const combinedTextToEmbed = [
        titleText, // 1st occurrence of title
        titleText, // 2nd occurrence of title (boosted)
        descriptionText, // 1st occurrence of description
        descriptionText, // 2nd occurrence of description (boosted)
        item.metadata ? `CONTENT: ${item.metadata}` : '',
        item.aiSummary ? `SUMMARY: ${item.aiSummary}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
        .trim()
        .slice(0, 8000);

      if (!combinedTextToEmbed) {
        console.log(`${progress} ⚠ Skipped "${item.title || item._id}" - no text to embed`);
        continue;
      }

      // Generate new embedding
      const embedding = await generateEmbedding(combinedTextToEmbed);

      // Update the item
      await Content.findByIdAndUpdate(item._id, { embedding });

      console.log(`${progress} ✓ "${item.title || 'Untitled'}"`);
      successCount++;
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      console.log(`${progress} ✗ "${item.title || 'Untitled'}" - ${errorMsg}`);
      failures.push({
        id: item._id.toString(),
        title: item.title || 'Untitled',
        error: errorMsg,
      });
      failCount++;
    }

    // Wait before processing next item (except for the last one)
    if (i < items.length - 1) {
      await sleep(DELAY_BETWEEN_ITEMS);
    }
  }

  // 4. Summary
  console.log('');
  console.log('[4/4] Summary');
  console.log('='.repeat(60));
  console.log(`      Total items:    ${items.length}`);
  console.log(`      Successful:     ${successCount}`);
  console.log(`      Failed:         ${failCount}`);

  if (failures.length > 0) {
    console.log('');
    console.log('Failed items:');
    failures.forEach((f) => {
      console.log(`  - ${f.title} (${f.id}): ${f.error}`);
    });
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Reprocessing complete!');
  console.log('='.repeat(60));

  // Disconnect and exit
  await mongoose.disconnect();
  process.exit(failures.length > 0 ? 1 : 0);
};

// Run the script
reprocessAllEmbeddings().catch((error) => {
  console.error('Script failed:', getErrorMessage(error));
  process.exit(1);
});
