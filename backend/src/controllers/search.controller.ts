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

    // 2. Perform the Vector Search in MongoDB
    const relevantContent = await Content.aggregate([
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 50,
          limit: 3,
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
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);

    if (relevantContent.length === 0) {
      res.status(200).json({
        answer: 'I could not find any relevant information in your brain to answer that.',
      });
      return;
    }

    // 3. Construct the Context String for the AI
    let contextString = '';
    relevantContent.forEach((item, index) => {
      contextString += `\n--- Item ${index + 1} ---\n`;
      contextString += `Title: ${item.title ?? 'Untitled'}\n`;
      contextString += `Notes: ${item.description ?? ''}\n`;
      contextString += `Content: ${item.metadata ?? ''} ${item.aiSummary ?? ''}\n`;
    });

    // 4. Generate the conversational answer using RAG
    const aiAnswer = await answerFromContext(query, contextString);

    res.status(200).json({
      answer: aiAnswer,
      sources: relevantContent,
    });
  } catch (error) {
    console.error('Vector search / Chat error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
