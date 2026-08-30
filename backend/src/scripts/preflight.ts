/**
 * Verifies the cluster and Redis are in the shape the app expects.
 *
 * Usage:
 *   npm run preflight
 *
 * The Atlas UI shows the same field list whether or not a vector filter path,
 * a multi-analyzer or an autocomplete mapping was saved, so those are read back
 * from the index definition here and repaired from atlas-indexes/.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { getErrorMessage } from '../lib/errors.js';

const INDEX_DEFINITION_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../atlas-indexes'
);

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 300000;

interface SearchIndex {
  name: string;
  status?: string;
  queryable?: boolean;
  latestDefinition?: Record<string, unknown>;
}

let failures = 0;

const pass = (message: string): void => console.log(`  PASS  ${message}`);

const fail = (message: string): void => {
  failures += 1;
  console.log(`  FAIL  ${message}`);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const readDefinition = async (name: string): Promise<Record<string, unknown>> => {
  const raw = await readFile(path.join(INDEX_DEFINITION_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
};

const listSearchIndexes = async (collectionName: string): Promise<SearchIndex[]> => {
  const collection = mongoose.connection.db?.collection(collectionName);
  if (!collection) throw new Error('No database handle');
  return (await collection.listSearchIndexes().toArray()) as unknown as SearchIndex[];
};

const findIndex = (indexes: SearchIndex[], name: string): SearchIndex | undefined =>
  indexes.find((index) => index.name === name);

/** Applies a definition from atlas-indexes/ and waits for the index to be queryable again. */
const repairIndex = async (
  collectionName: string,
  indexName: string,
  reason: string
): Promise<void> => {
  console.log(`  ....  repairing ${indexName}: ${reason}`);

  const collection = mongoose.connection.db?.collection(collectionName);
  if (!collection) throw new Error('No database handle');

  await collection.updateSearchIndex(indexName, await readDefinition(indexName));

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const index = findIndex(await listSearchIndexes(collectionName), indexName);
    if (index?.status === 'READY') {
      pass(`${indexName} rebuilt and READY`);
      return;
    }
  }

  fail(`${indexName} did not return to READY within ${POLL_TIMEOUT_MS / 1000}s`);
};

/** chunk_vector_index must declare userId and contentId as filter paths. */
const vectorFilterPaths = (index: SearchIndex): string[] => {
  const fields = index.latestDefinition?.fields;
  if (!Array.isArray(fields)) return [];
  return fields
    .filter((field): field is { type: string; path: string } => {
      return (
        typeof field === 'object' &&
        field !== null &&
        (field as { type?: unknown }).type === 'filter' &&
        typeof (field as { path?: unknown }).path === 'string'
      );
    })
    .map((field) => field.path);
};

interface FieldMapping {
  type?: string;
  norms?: string;
  multi?: Record<string, { norms?: string }>;
}

/**
 * A field may carry one mapping or an array of them: `title` holds both a string
 * and an autocomplete mapping, so every check reads the list form.
 */
const fieldMappings = (index: SearchIndex, fieldName: string): FieldMapping[] => {
  const mappings = index.latestDefinition?.mappings as
    { fields?: Record<string, unknown> } | undefined;
  const field = mappings?.fields?.[fieldName];
  if (!field) return [];
  return (Array.isArray(field) ? field : [field]) as FieldMapping[];
};

/** content_text_index must expose an `english` multi-analyzer on the given path. */
const hasEnglishMulti = (index: SearchIndex, fieldName: string): boolean =>
  fieldMappings(index, fieldName).some((mapping) => Boolean(mapping.multi?.english));

/** Prefix matching on titles needs a second, autocomplete mapping on the field. */
const hasAutocomplete = (index: SearchIndex, fieldName: string): boolean =>
  fieldMappings(index, fieldName).some((mapping) => mapping.type === 'autocomplete');

/**
 * Without norms omitted, BM25 length normalization makes a hit in the short
 * topics array outscore a hit in a real description.
 */
const omitsNorms = (index: SearchIndex, fieldName: string): boolean =>
  fieldMappings(index, fieldName).some(
    (mapping) =>
      mapping.type === 'string' &&
      mapping.norms === 'omit' &&
      mapping.multi?.english?.norms === 'omit'
  );

const checkMongo = async (): Promise<void> => {
  console.log('\n[1] MongoDB');

  await mongoose.connect(env.DATABASE_URL, { serverSelectionTimeoutMS: 15000 });

  const admin = mongoose.connection.db?.admin();
  const info = await admin?.serverInfo();
  const version = String(info?.version ?? '0.0.0');
  const major = Number(version.split('.')[0] ?? 0);

  if (major >= 8) {
    pass(`connected, server version ${version}`);
  } else {
    fail(`server version ${version} is below 8.0 — $rankFusion is unavailable`);
  }
};

const checkRedis = async (): Promise<void> => {
  console.log('\n[2] Redis');

  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 10000,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    const reply = await redis.ping();
    if (reply === 'PONG') {
      pass('PING returned PONG');
    } else {
      fail(`PING returned ${reply}`);
    }
  } catch (error) {
    fail(`could not reach Redis: ${getErrorMessage(error)}`);
  } finally {
    redis.disconnect();
  }
};

const checkChunkIndexes = async (): Promise<void> => {
  console.log('\n[3] chunks search indexes');

  const indexes = await listSearchIndexes('chunks');

  for (const name of ['chunk_vector_index', 'chunk_text_index']) {
    const index = findIndex(indexes, name);
    if (!index) {
      fail(`${name} does not exist`);
    } else if (index.status !== 'READY') {
      fail(`${name} status is ${index.status ?? 'unknown'}, expected READY`);
    } else {
      pass(`${name} is READY`);
    }
  }
};

const checkContentIndex = async (): Promise<void> => {
  console.log('\n[4] contents search index');

  const index = findIndex(await listSearchIndexes('contents'), 'content_text_index');
  if (!index) {
    fail('content_text_index does not exist');
  } else if (index.status !== 'READY') {
    fail(`content_text_index status is ${index.status ?? 'unknown'}, expected READY`);
  } else {
    pass('content_text_index is READY');
  }
};

const checkVectorFilterPaths = async (): Promise<void> => {
  console.log('\n[5] chunk_vector_index filter paths');

  const index = findIndex(await listSearchIndexes('chunks'), 'chunk_vector_index');
  if (!index) {
    fail('chunk_vector_index does not exist');
    return;
  }

  const paths = vectorFilterPaths(index);
  const missing = ['userId', 'contentId'].filter((field) => !paths.includes(field));

  if (missing.length === 0) {
    pass('userId and contentId are declared as filter paths');
    return;
  }

  await repairIndex(
    'chunks',
    'chunk_vector_index',
    `missing filter path(s): ${missing.join(', ')} — "see more" cannot exclude shown items without them`
  );
};

const checkContentMappings = async (): Promise<void> => {
  console.log('\n[6] content_text_index field mappings');

  const index = findIndex(await listSearchIndexes('contents'), 'content_text_index');
  if (!index) {
    fail('content_text_index does not exist');
    return;
  }

  const problems: string[] = [];

  const missingMulti = ['title', 'description', 'topics'].filter(
    (field) => !hasEnglishMulti(index, field)
  );
  if (missingMulti.length > 0) {
    problems.push(
      `missing english multi-analyzer on: ${missingMulti.join(', ')} — half the plain-search clauses would silently match nothing`
    );
  }

  if (!hasAutocomplete(index, 'title')) {
    problems.push('title has no autocomplete mapping — the prefix clause would match nothing');
  }

  if (!omitsNorms(index, 'topics')) {
    problems.push('topics does not omit norms — one topics hit would bury every real match');
  }

  if (problems.length === 0) {
    pass('english multi-analyzers, title autocomplete and topics norms:omit are all in place');
    return;
  }

  await repairIndex('contents', 'content_text_index', problems.join('; '));
};

const runPreflight = async (): Promise<void> => {
  console.log('Contexio preflight');

  try {
    await checkMongo();
    await checkRedis();
    await checkChunkIndexes();
    await checkContentIndex();
    await checkVectorFilterPaths();
    await checkContentMappings();
  } catch (error) {
    fail(getErrorMessage(error));
  }

  await mongoose.disconnect();

  console.log('');
  if (failures > 0) {
    console.error(`Preflight failed: ${failures} check(s) did not pass.`);
    process.exit(1);
  }
  console.log('Preflight passed: every check is green.');
  process.exit(0);
};

runPreflight().catch((error) => {
  console.error('Preflight crashed:', getErrorMessage(error));
  process.exit(1);
});
