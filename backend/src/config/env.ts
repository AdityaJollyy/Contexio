import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Server
  // PORT stays a string — it is parsed at its call site in index.ts.
  PORT: z.string().default('3000'),
  DATABASE_URL: z.url({ message: 'DATABASE_URL must be a valid URL' }),
  JWT_SECRET: z.string().min(10, { message: 'JWT_SECRET must be at least 10 characters long' }),
  ALLOWED_ORIGINS: z.string().optional(),

  // Redis
  REDIS_URL: z.string().min(1, { message: 'REDIS_URL is required' }),

  // Gemini
  GEMINI_API_KEY: z.string().min(1, { message: 'GEMINI_API_KEY is required' }),
  GEMINI_MODEL_PRIMARY: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_MODEL_FALLBACK: z.string().default('gemini-3.7-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  // Must stay in lockstep with numDimensions in chunk_vector_index.
  GEMINI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  // Background worker
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(3),
  WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  WORKER_BACKOFF_MS: z.coerce.number().int().positive().default(5000),
  WORKER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(8),
  WORKER_RATE_LIMIT_DURATION_MS: z.coerce.number().int().positive().default(60000),
  RUN_WORKER_IN_API: z.enum(['true', 'false']).default('true'),

  // Per-user AI quota
  AI_CHAT_DAILY_LIMIT: z.coerce.number().int().positive().default(10),

  // Per-user limits. Every save costs a Gemini generate plus an embed on one
  // shared key, so an uncapped bulk import spends the day for every user.
  MAX_ITEMS_PER_USER: z.coerce.number().int().positive().default(1000),
  CONTENT_WRITE_RATE_MAX: z.coerce.number().int().positive().default(60),
  PLAIN_SEARCH_RATE_MAX: z.coerce.number().int().positive().default(120),

  // Extraction
  YOUTUBE_API_KEY: z.string().min(1, { message: 'YOUTUBE_API_KEY is required' }),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  SCRAPER_MAX_BYTES: z.coerce.number().int().positive().default(2000000),
  SCRAPER_MAX_CHARS: z.coerce.number().int().positive().default(30000),

  // Chunking
  CHUNK_SIZE: z.coerce.number().int().positive().default(1200),
  CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(200),
  MAX_CHUNKS_PER_ITEM: z.coerce.number().int().positive().default(20),

  // Plain search
  MAX_QUERY_CHARS: z.coerce.number().int().positive().default(200),
  BROWSE_SEARCH_LIMIT: z.coerce.number().int().positive().default(50),
  // Below this many literal matches, the fuzzy suggestions pass also runs.
  FUZZY_FALLBACK_MIN: z.coerce.number().int().positive().default(3),

  // AI search
  VECTOR_NUM_CANDIDATES: z.coerce.number().int().positive().default(300),
  VECTOR_SEARCH_LIMIT: z.coerce.number().int().positive().default(80),
  RAG_TOP_K: z.coerce.number().int().positive().default(5),
  RELEVANCE_MIN_SCORE: z.coerce.number().nonnegative().default(0.8),
  // Scan ceiling for the exhaustive count query. Hitting it makes the count a
  // lower bound, which the UI renders as "5+".
  RELEVANCE_COUNT_LIMIT: z.coerce.number().int().positive().default(2000),
  // Ceiling on the inline match list. Past it the UI points at plain search.
  ALL_MATCHES_LIMIT: z.coerce.number().int().positive().default(50),
});

const envParse = envSchema.safeParse(process.env);

if (!envParse.success) {
  console.error('Invalid environment variables:', envParse.error);
  process.exit(1);
}

export const env = envParse.data;
