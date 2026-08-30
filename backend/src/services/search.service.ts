import mongoose, { type PipelineStage } from 'mongoose';
import { Content } from '../models/content.model.js';
import { Chunk } from '../models/chunk.model.js';
import { env } from '../config/env.js';
import { generateEmbedding } from './ai.service.js';

export type ContentType = 'youtube' | 'twitter' | 'github' | 'text' | 'others';

export interface BrowseResult {
  _id: string;
  title: string;
  description: string;
  link: string;
  type: ContentType;
  topics: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetrievedContent {
  contentId: string;
  title: string;
  description: string;
  topics: string[];
  link: string;
  type: ContentType;
  createdAt: Date;
  matchedText: string;
  score: number; // normalized vector similarity, 0-1
}

/** A pasted paragraph is noise across every clause, so it is cut to length. */
const normalizeQuery = (rawQuery: string): string =>
  rawQuery.trim().replace(/\s+/g, ' ').slice(0, env.MAX_QUERY_CHARS);

const longestTokenLength = (query: string): number =>
  query.split(' ').reduce((longest, token) => Math.max(longest, token.length), 0);

export interface BrowseSearchResult {
  results: BrowseResult[];
  suggestions: BrowseResult[];
  total: number;
}

/** The tier-1 ladder: literal, stemmed and prefix hits, title before note before topics. */
const strictClauses = (query: string): Record<string, unknown>[] => {
  const should: Record<string, unknown>[] = [
    { phrase: { query, path: 'title', slop: 1, score: { boost: { value: 10 } } } },
    { text: { query, path: 'title', score: { boost: { value: 7 } } } },
    { text: { query, path: { value: 'title', multi: 'english' }, score: { boost: { value: 5 } } } },
    { phrase: { query, path: 'description', slop: 2, score: { boost: { value: 4 } } } },
    { text: { query, path: 'description', score: { boost: { value: 3 } } } },
    {
      text: {
        query,
        path: { value: 'description', multi: 'english' },
        score: { boost: { value: 2.5 } },
      },
    },
    // Constant, not boosted. `topics` is a controlled vocabulary of ~8 tags, not
    // prose, so BM25 term rarity over it is meaningless: a word the tagger used
    // once outscores the same word in a real description by an order of
    // magnitude. These values sit below a description hit and a title hit, which
    // is the ordering the ladder exists to express. Ranking among topics-only
    // hits is flat, and the createdAt tie-break settles them.
    { text: { query, path: 'topics', score: { constant: { value: 0.3 } } } },
    {
      text: {
        query,
        path: { value: 'topics', multi: 'english' },
        score: { constant: { value: 0.2 } },
      },
    },
  ];

  // minGrams is 3, so a shorter query can only match noise.
  if (query.length >= 3) {
    should.push({
      autocomplete: {
        query,
        path: 'title',
        tokenOrder: 'sequential',
        score: { boost: { value: 1 } },
      },
    });
  }

  return should;
};

/** The tier-2 ladder: one fuzzy clause, never mixed into tier 1. */
const fuzzyClauses = (query: string): Record<string, unknown>[] => [
  { text: { query, path: 'title', fuzzy: { maxEdits: 1, prefixLength: 2 } } },
];

/**
 * One $search call. `strict` matches literally, `fuzzy` matches typos; two calls
 * because working out which clause fired from scoreDetails costs more machinery
 * than running the query twice.
 *
 * Nothing is score-filtered. A term in most of a personal library is what that
 * person collects, not noise to threshold away.
 */
const runSearch = async (
  userId: string,
  query: string,
  mode: 'strict' | 'fuzzy'
): Promise<BrowseResult[]> => {
  const results = await Content.aggregate<BrowseResult>([
    {
      $search: {
        index: 'content_text_index',
        compound: {
          filter: [{ equals: { path: 'userId', value: new mongoose.Types.ObjectId(userId) } }],
          should: mode === 'strict' ? strictClauses(query) : fuzzyClauses(query),
          minimumShouldMatch: 1,
        },
      },
    },
    { $addFields: { score: { $meta: 'searchScore' } } },
    // Near-identical items tie constantly, and without a tie-break the order
    // shifts between identical searches. Newest-first among equals.
    { $sort: { score: -1, createdAt: -1 } },
    { $limit: env.BROWSE_SEARCH_LIMIT },
    { $project: { metadata: 0, aiSummary: 0, __v: 0, score: 0 } },
  ]);

  return results;
};

/**
 * Two tiers: literal matches, then fuzzy suggestions when there were barely any.
 * They come back separately so the UI can label a guess as a guess.
 */
export const searchContents = async (
  userId: string,
  rawQuery: string
): Promise<BrowseSearchResult> => {
  const query = normalizeQuery(rawQuery);
  if (!query) return { results: [], suggestions: [], total: 0 };

  const results = await runSearch(userId, query, 'strict');

  if (results.length >= env.FUZZY_FALLBACK_MIN) {
    return { results, suggestions: [], total: results.length };
  }

  // One edit on a short token turns "cat" into "car", "bat", "cut".
  if (longestTokenLength(query) < 4) {
    return { results, suggestions: [], total: results.length };
  }

  const shown = new Set(results.map((item) => item._id.toString()));
  const suggestions = (await runSearch(userId, query, 'fuzzy')).filter(
    (item) => !shown.has(item._id.toString())
  );

  return { results, suggestions, total: results.length };
};

interface FusedChunk {
  contentId: mongoose.Types.ObjectId;
  text: string;
  vectorScore: number | null;
  content: {
    _id: mongoose.Types.ObjectId;
    title: string;
    description: string;
    topics: string[];
    link: string;
    type: ContentType;
    createdAt: Date;
  } | null;
}

export interface MatchSummary {
  contentId: string;
  title: string;
  link: string;
  type: ContentType;
  createdAt: Date;
}

export interface AiSearchResult {
  /** Top RAG_TOP_K above the floor, with chunk text — what the model explains. */
  results: RetrievedContent[];
  /** Every item above the floor, score-sorted, capped at ALL_MATCHES_LIMIT. */
  allMatches: MatchSummary[];
  /** True count above the floor. May exceed allMatches.length. */
  totalMatches: number;
  /** The scan hit RELEVANCE_COUNT_LIMIT, so totalMatches is a lower bound. */
  totalCapped: boolean;
}

interface CountFacet {
  chunks: { n: number }[];
  items: {
    _id: mongoose.Types.ObjectId;
    title: string;
    link: string;
    type: ContentType;
    createdAt: Date;
  }[];
  total: { n: number }[];
}

const EMPTY_RESULT: AiSearchResult = {
  results: [],
  allMatches: [],
  totalMatches: 0,
  totalCapped: false,
};

/**
 * Hybrid retrieval over chunks, grouped back up to one row per saved item. One
 * page, no continuation: browsing is plain search's job.
 *
 * Two concurrent queries answering different questions. The display query ranks
 * the closest handful and carries the chunk text the model explains. The count
 * query answers which items in the whole corpus clear the floor, exhaustively —
 * a count taken from the display query's retrieval window is a sample of that
 * window, not a fact about the corpus.
 */
export const findRelevantContents = async (
  userId: string,
  rawQuery: string
): Promise<AiSearchResult> => {
  const query = normalizeQuery(rawQuery);
  if (!query) return EMPTY_RESULT;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const queryVector = await generateEmbedding(query, 'RETRIEVAL_QUERY');
  const vectorFilter = { userId: userObjectId };

  // Mongoose's PipelineStage union does not yet know $rankFusion, which is a
  // MongoDB 8.0 stage. The cast is scoped to this one stage.
  const rankFusionStage = {
    $rankFusion: {
      input: {
        pipelines: {
          vectorPipeline: [
            {
              $vectorSearch: {
                index: 'chunk_vector_index',
                path: 'embedding',
                queryVector,
                numCandidates: env.VECTOR_NUM_CANDIDATES,
                limit: env.VECTOR_SEARCH_LIMIT,
                filter: vectorFilter,
              },
            },
          ],
          // Vectors are weak on proper nouns, and people search saved items by
          // name constantly. One field, so no boost ladder.
          textPipeline: [
            {
              $search: {
                index: 'chunk_text_index',
                compound: {
                  must: [{ text: { query, path: 'text' } }],
                  filter: [{ equals: { path: 'userId', value: userObjectId } }],
                },
              },
            },
            { $limit: env.VECTOR_SEARCH_LIMIT },
          ],
        },
      },
      combination: { weights: { vectorPipeline: 0.7, textPipeline: 0.3 } },
      // $rankFusion input pipelines accept selection stages only, so the
      // similarity cannot be projected inside the vector pipeline. scoreDetails
      // carries each input pipeline's raw score out alongside the fused rank.
      scoreDetails: true,
    },
  } as unknown as PipelineStage;

  // `exact: true` runs ENN: an exhaustive scan, no approximation, no
  // numCandidates to tune. At personal-library scale that is tens of
  // milliseconds, and the count has to be exact because it is shown to the user
  // as a number they can click. The `chunks` branch detects the scan ceiling.
  const countStage = {
    $vectorSearch: {
      index: 'chunk_vector_index',
      path: 'embedding',
      queryVector,
      exact: true,
      limit: env.RELEVANCE_COUNT_LIMIT,
      filter: vectorFilter,
    },
  } as unknown as PipelineStage;

  const countPipeline: PipelineStage[] = [
    countStage,
    { $project: { contentId: 1, score: { $meta: 'vectorSearchScore' } } },
    {
      $facet: {
        chunks: [{ $count: 'n' }],
        // The $limit above bounds the $lookup to ALL_MATCHES_LIMIT documents.
        items: [
          { $group: { _id: '$contentId', score: { $max: '$score' } } },
          { $match: { score: { $gte: env.RELEVANCE_MIN_SCORE } } },
          { $sort: { score: -1 } },
          { $limit: env.ALL_MATCHES_LIMIT },
          {
            $lookup: {
              from: 'contents',
              localField: '_id',
              foreignField: '_id',
              pipeline: [{ $project: { title: 1, link: 1, type: 1, createdAt: 1 } }],
              as: 'content',
            },
          },
          { $unwind: { path: '$content', preserveNullAndEmptyArrays: false } },
          {
            $project: {
              title: '$content.title',
              link: '$content.link',
              type: '$content.type',
              createdAt: '$content.createdAt',
            },
          },
        ],
        // Counted separately, because `items` is capped and this is not.
        total: [
          { $group: { _id: '$contentId', score: { $max: '$score' } } },
          { $match: { score: { $gte: env.RELEVANCE_MIN_SCORE } } },
          { $count: 'n' },
        ],
      },
    },
  ];

  // Concurrent: the display query is the slower of the two, so the count rides
  // alongside it for no extra wall-clock time.
  const [fused, countFacets] = await Promise.all([
    Chunk.aggregate<FusedChunk>([
      rankFusionStage,
      { $addFields: { scoreDetails: { $meta: 'scoreDetails' } } },
      {
        $lookup: {
          from: 'contents',
          localField: 'contentId',
          foreignField: '_id',
          pipeline: [
            { $project: { title: 1, description: 1, topics: 1, link: 1, type: 1, createdAt: 1 } },
          ],
          as: 'content',
        },
      },
      { $unwind: { path: '$content', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          contentId: 1,
          text: 1,
          content: 1,
          // Null for a keyword-only match: it never reached the vector pipeline.
          vectorScore: {
            $ifNull: [
              {
                $getField: {
                  field: 'value',
                  input: {
                    $first: {
                      $filter: {
                        input: '$scoreDetails.details',
                        as: 'pipeline',
                        cond: { $eq: ['$$pipeline.inputPipelineName', 'vectorPipeline'] },
                      },
                    },
                  },
                },
              },
              null,
            ],
          },
        },
      },
    ]),
    Chunk.aggregate<CountFacet>(countPipeline),
  ]);

  const facet = countFacets[0];
  const scannedChunks = facet?.chunks[0]?.n ?? 0;
  const totalMatches = facet?.total[0]?.n ?? 0;
  const totalCapped = scannedChunks >= env.RELEVANCE_COUNT_LIMIT;

  // Grouped back to one row per item, in fused rank order. Without this a long
  // item floods the page with its own chunks.
  const grouped: RetrievedContent[] = [];
  const seen = new Map<string, RetrievedContent>();

  for (const chunk of fused) {
    if (!chunk.content) continue;

    const contentId = chunk.contentId.toString();
    const existing = seen.get(contentId);

    if (existing) {
      // A later chunk of the same item ranks lower, but may score higher.
      if (chunk.vectorScore !== null && chunk.vectorScore > existing.score) {
        existing.score = chunk.vectorScore;
      }
      continue;
    }

    const entry: RetrievedContent = {
      contentId,
      title: chunk.content.title,
      description: chunk.content.description,
      topics: chunk.content.topics ?? [],
      link: chunk.content.link,
      type: chunk.content.type,
      createdAt: chunk.content.createdAt,
      matchedText: chunk.text,
      score: chunk.vectorScore ?? 0,
    };

    seen.set(contentId, entry);
    grouped.push(entry);
  }

  // Embeddings never return nothing: an unrelated query still comes back with
  // the least-unrelated rows. The top score decides whether the library holds
  // anything close at all. A per-item filter alone would let one borderline row
  // through and answer an off-topic question with a single wrong item.
  const topScore = grouped.reduce((best, item) => Math.max(best, item.score), 0);
  // RELEVANCE_MIN_SCORE is calibrated against one corpus; logging the top score
  // is what lets it be revisited against real libraries.
  console.log(
    `AI search topScore=${topScore.toFixed(4)} floor=${env.RELEVANCE_MIN_SCORE} ` +
      `matches=${totalMatches}${totalCapped ? '+' : ''}`
  );

  // The caller's empty-result path refunds the quota and never calls the model.
  if (topScore < env.RELEVANCE_MIN_SCORE) return EMPTY_RESULT;

  // Keyword-only matches sit at 0 and drop out here with everything else below
  // the floor.
  const relevant = grouped.filter((item) => item.score >= env.RELEVANCE_MIN_SCORE);

  const allMatches: MatchSummary[] = (facet?.items ?? []).map((item) => ({
    contentId: item._id.toString(),
    title: item.title,
    link: item.link,
    type: item.type,
    createdAt: item.createdAt,
  }));

  return {
    results: relevant.slice(0, env.RAG_TOP_K),
    allMatches,
    totalMatches,
    totalCapped,
  };
};
