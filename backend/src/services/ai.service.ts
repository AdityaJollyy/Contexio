import {
  GoogleGenAI,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';
import { env } from '../config/env.js';
import { getErrorMessage } from '../lib/errors.js';
import { ENRICH_SYSTEM_INSTRUCTION } from '../prompts/enrich.prompt.js';

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// The embedding model produces different vectors for text being indexed and
// text being searched with. Mixing the two puts them in mismatched spaces.
type EmbeddingTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

const EMBEDDING_BATCH_SIZE = 100;

/** 429 rate limit, 500 internal, 503 overloaded — worth a second model. */
const isRetryableGeminiError = (error: unknown): boolean => {
  const message = getErrorMessage(error);
  return /\b(429|500|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|INTERNAL|overloaded/i.test(message);
};

/** Google returns the wait as `"retryDelay": "12s"` inside the 429 body. */
const parseRetryDelayMs = (error: unknown): number => {
  const match = getErrorMessage(error).match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (!match?.[1]) return 0;
  return Math.min(Number(match[1]) * 1000, env.GEMINI_TIMEOUT_MS);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a generation against the primary model, falling back to the secondary
 * one only for errors a different model could actually survive.
 */
const generateWithFallback = async (
  params: Omit<GenerateContentParameters, 'model'>
): Promise<GenerateContentResponse> => {
  try {
    return await ai.models.generateContent({ ...params, model: env.GEMINI_MODEL_PRIMARY });
  } catch (error) {
    if (!isRetryableGeminiError(error)) throw error;

    console.warn('Primary model failed, falling back:', getErrorMessage(error));

    const retryDelayMs = parseRetryDelayMs(error);
    if (retryDelayMs > 0) await sleep(retryDelayMs);

    return await ai.models.generateContent({ ...params, model: env.GEMINI_MODEL_FALLBACK });
  }
};

/** Streamed generation, with the same primary/fallback policy. */
export const generateStreamWithFallback = async (
  params: Omit<GenerateContentParameters, 'model'>
): Promise<AsyncGenerator<GenerateContentResponse>> => {
  try {
    return await ai.models.generateContentStream({ ...params, model: env.GEMINI_MODEL_PRIMARY });
  } catch (error) {
    if (!isRetryableGeminiError(error)) throw error;

    console.warn('Primary model failed, falling back:', getErrorMessage(error));

    const retryDelayMs = parseRetryDelayMs(error);
    if (retryDelayMs > 0) await sleep(retryDelayMs);

    return await ai.models.generateContentStream({ ...params, model: env.GEMINI_MODEL_FALLBACK });
  }
};

/**
 * Embeds a batch of texts. `taskType` must be RETRIEVAL_DOCUMENT when indexing
 * and RETRIEVAL_QUERY when searching.
 */
export const generateEmbeddings = async (
  texts: string[],
  taskType: EmbeddingTask
): Promise<number[][]> => {
  const usable = texts.filter((text) => text.trim() !== '');
  if (usable.length === 0) return [];

  const vectors: number[][] = [];

  for (let start = 0; start < usable.length; start += EMBEDDING_BATCH_SIZE) {
    const batch = usable.slice(start, start + EMBEDDING_BATCH_SIZE);

    const result = await ai.models.embedContent({
      model: env.GEMINI_EMBEDDING_MODEL,
      contents: batch,
      config: {
        taskType,
        outputDimensionality: env.GEMINI_EMBEDDING_DIMENSIONS,
        abortSignal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
      },
    });

    const embeddings = result.embeddings ?? [];
    if (embeddings.length !== batch.length) {
      throw new Error(
        `Embedding count mismatch: asked for ${batch.length}, received ${embeddings.length}`
      );
    }

    for (const embedding of embeddings) {
      const values = embedding.values;
      if (!values?.length) throw new Error('Embedding API returned an empty vector');
      vectors.push(values);
    }
  }

  return vectors;
};

/** Single-text convenience wrapper for the query path. */
export const generateEmbedding = async (
  text: string,
  taskType: EmbeddingTask
): Promise<number[]> => {
  const [vector] = await generateEmbeddings([text], taskType);
  if (!vector) throw new Error('Failed to generate embedding');
  return vector;
};

/**
 * Describes an item so it can be recalled later: what it is, plus the keywords
 * someone would search for. Best-effort — it must never fail the whole job.
 */
export const enrichContent = async (
  title: string,
  link: string,
  description: string,
  body: string
): Promise<{ summary: string; topics: string[] }> => {
  const item = [
    `TITLE: ${title}`,
    link ? `LINK: ${link}` : '',
    description ? `OWNER'S NOTE: ${description}` : '',
    body ? `EXTRACTED TEXT: ${body}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const response = await generateWithFallback({
      contents: item,
      config: {
        systemInstruction: ENRICH_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            topics: { type: 'array', items: { type: 'string' } },
          },
          required: ['summary', 'topics'],
        },
        abortSignal: AbortSignal.timeout(env.GEMINI_TIMEOUT_MS),
      },
    });

    const parsed: unknown = JSON.parse(response.text?.trim() || '{}');
    if (typeof parsed !== 'object' || parsed === null) return { summary: '', topics: [] };

    const { summary, topics } = parsed as { summary?: unknown; topics?: unknown };

    return {
      summary: typeof summary === 'string' ? summary.trim() : '',
      topics: Array.isArray(topics)
        ? topics
            .filter((topic): topic is string => typeof topic === 'string')
            .map((topic) => topic.trim())
            .filter(Boolean)
        : [],
    };
  } catch (error) {
    console.error('Enrichment failed:', getErrorMessage(error));
    return { summary: '', topics: [] };
  }
};
