import { type Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Content } from '../models/content.model.js';
import { type AuthRequest } from '../middlewares/auth.middleware.js';
import { generateEmbedding, answerFromContext } from '../services/ai.service.js';
import { escapeRegex } from '../lib/utils.js';

const searchSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters'),
});

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

    const { query } = parsed.data;
    const userId = req.userId;
    const safeQuery = escapeRegex(query);

    const contents = await Content.find(
      {
        userId,
        $or: [
          { title: { $regex: safeQuery, $options: 'i' } },
          { description: { $regex: safeQuery, $options: 'i' } },
        ],
      },
      { metadata: 0, aiSummary: 0, embedding: 0, __v: 0 }
    ).limit(20);

    res.status(200).json({ contents });
  } catch (error) {
    console.error('Regular search error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const chatWithBrain = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid query', errors: parsed.error.format() });
      return;
    }

    const { query } = parsed.data;
    const userId = req.userId;

    // 1. Embed the user's question
    const queryVector = await generateEmbedding(query);

    // 2. Perform Vector Search in MongoDB (embeddings now have boosted title/description)
    const relevantContent = await Content.aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 50,
          limit: 5,
          filter: { userId: new mongoose.Types.ObjectId(userId) },
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          aiSummary: 1,
          metadata: 1,
          link: 1,
          type: 1,
          createdAt: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        $match: { score: { $gte: 0.5 } },
      },
    ]);

    if (relevantContent.length === 0) {
      res.status(200).json({
        answer:
          "I couldn't find anything related to that in your saved content. Try saving some relevant links or notes first, and I'll be able to help you better!",
      });
      return;
    }

    // 3. Construct the Context String for the AI
    let contextString = '';
    relevantContent.forEach((item, index) => {
      contextString += `--- Item ${index + 1} ---\n`;
      contextString += `Title: ${item.title ?? 'Untitled'}\n`;
      contextString += `Description (user's own notes): ${item.description || 'No description provided'}\n`;
      contextString += `AI-Generated Summary: ${item.aiSummary || 'No summary available'}\n`;
      contextString += `Type: ${item.type ?? 'unknown'}\n`;
      contextString += '\n';
    });

    // 4. Generate the conversational answer using RAG
    const { answer, usedSourceIndices } = await answerFromContext(
      query,
      contextString,
      relevantContent.length
    );

    // 5. Filter sources to only include those actually used in the answer
    const filteredSources = usedSourceIndices
      .map((index) => relevantContent[index])
      .filter(Boolean);

    res.status(200).json({
      answer,
      sources: filteredSources,
    });
  } catch (error) {
    console.error('Vector search / Chat error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
