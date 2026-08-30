import { type Response } from 'express';
import { z } from 'zod';
import { type AuthRequest } from '../middlewares/auth.middleware.js';
import { getErrorMessage } from '../lib/errors.js';
import {
  searchContents,
  findRelevantContents,
  type RetrievedContent,
} from '../services/search.service.js';
import { generateStreamWithFallback } from '../services/ai.service.js';
import { consumeAiQuota, refundAiQuota, getAiQuota } from '../services/quota.service.js';
import { SEARCH_SYSTEM_INSTRUCTION } from '../prompts/search.prompt.js';

// Two characters is a real search in a technical library — `AI`, `Go`, `k8`.
// They match as whole tokens but do not prefix-match: minGrams is 3.
const searchSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters'),
});

const chatSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters'),
});

const CITATION_PATTERN = /\[\[([a-f0-9]{24})\]\]/g;

const NOTHING_FOUND = "I couldn't find anything matching that in your saved items.";

export const regularSearch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid query', errors: parsed.error.format() });
      return;
    }

    const { results, suggestions, total } = await searchContents(req.userId, parsed.data.query);

    res.status(200).json({ results, suggestions, total });
  } catch (error) {
    console.error('Regular search error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getQuota = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const quota = await getAiQuota(req.userId);

    res.status(200).json(quota);
  } catch (error) {
    console.error('Get quota error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const sendEvent = (res: Response, event: string, data: unknown): void => {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

/** Context items are keyed by contentId so citations survive reordering. */
const buildContext = (results: RetrievedContent[]): string =>
  results
    .map((item) =>
      [
        `--- Source [[${item.contentId}]] ---`,
        `Title: ${item.title}`,
        `Owner's notes: ${item.description || 'none'}`,
        `Topics: ${item.topics.join(', ') || 'none'}`,
        `Matched text: ${item.matchedText}`,
      ].join('\n')
    )
    .join('\n\n');

export const chatWithBrain = async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid query', errors: parsed.error.format() });
    return;
  }

  const userId = req.userId;
  const { query } = parsed.data;

  const claim = await consumeAiQuota(userId);
  if (!claim.allowed) {
    res.status(429).json({
      message: 'Daily AI limit reached. Resets at midnight UTC.',
      used: claim.used,
      limit: claim.limit,
    });
    return;
  }

  let quota = { used: claim.used, limit: claim.limit };
  let quotaSpent = true;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // A closed tab must stop burning quota mid-generation.
  const abortController = new AbortController();
  res.on('close', () => abortController.abort());

  try {
    const { results, allMatches, totalMatches, totalCapped } = await findRelevantContents(
      userId,
      query
    );

    if (results.length === 0) {
      await refundAiQuota(userId);
      quotaSpent = false;
      quota = await getAiQuota(userId);

      sendEvent(res, 'done', {
        text: NOTHING_FOUND,
        sources: [],
        allMatches: [],
        totalMatches: 0,
        totalCapped: false,
        quota,
      });
      res.end();
      return;
    }

    const stream = await generateStreamWithFallback({
      contents: `Saved items:\n\n${buildContext(results)}\n\nWhat they described: ${query}`,
      config: {
        systemInstruction: SEARCH_SYSTEM_INSTRUCTION,
        abortSignal: abortController.signal,
      },
    });

    let answer = '';
    for await (const chunk of stream) {
      const text = chunk.text;
      if (!text) continue;
      answer += text;
      sendEvent(res, 'token', { text });
    }

    // Validated against what was retrieved, so a hallucinated citation is
    // dropped rather than shown as a source.
    const retrieved = new Map(results.map((item) => [item.contentId, item]));
    const cited: string[] = [];
    for (const match of answer.matchAll(CITATION_PATTERN)) {
      const id = match[1];
      if (id && retrieved.has(id) && !cited.includes(id)) cited.push(id);
    }

    const sources = cited.map((id) => {
      const item = retrieved.get(id)!;
      return {
        _id: item.contentId,
        title: item.title,
        description: item.description,
        link: item.link,
        type: item.type,
        topics: item.topics,
        createdAt: item.createdAt,
        score: item.score,
      };
    });

    sendEvent(res, 'done', { sources, allMatches, totalMatches, totalCapped, quota });
    res.end();
  } catch (error) {
    console.error('AI search error:', getErrorMessage(error));

    if (quotaSpent) await refundAiQuota(userId);

    // Headers are already flushed, so the error travels as an event.
    if (!res.writableEnded) {
      sendEvent(res, 'error', { message: 'Something went wrong while searching your items.' });
      res.end();
    }
  }
};
