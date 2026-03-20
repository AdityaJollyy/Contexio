import { type Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Content } from '../models/content.model.js';
import { type AuthRequest } from '../middlewares/auth.middleware.js';
import { generateEmbedding, answerFromContext } from '../services/ai.service.js';

const searchSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters'),
});

export const regularSearch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = searchSchema.safeParse(req.query); // Search text usually comes in the URL query string
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid query', errors: parsed.error });
      return;
    }

    const { query } = parsed.data;

    // Use a simple Regex search to find matching titles or descriptions
    const contents = await Content.find(
      {
        userId: req.userId!,
        $or: [
          { title: { $regex: query, $options: 'i' } }, // 'i' means case-insensitive
          { description: { $regex: query, $options: 'i' } },
        ],
      },
      { metadata: 0, aiSummary: 0, embedding: 0, __v: 0 } // Exclude heavy fields
    ).limit(20);

    res.status(200).json({ contents });
  } catch (error) {
    console.error('Regular search error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const chatWithBrain = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid query', errors: parsed.error.format() });
      return;
    }

    const { query } = parsed.data;

    // 1. Embed the user's question
    const queryVector = await generateEmbedding(query);

    // 2. Perform the Vector Search in MongoDB
    // Note: This aggregation pipeline STRICTLY requires the Atlas Vector Index we discussed.
    const relevantContent = await Content.aggregate([
      {
        $vectorSearch: {
          index: 'vector_index', // The exact name of the index in Atlas
          path: 'embedding',
          queryVector: queryVector,
          numCandidates: 50, // How many items it scans
          limit: 3, // Only return the top 3 most relevant items
          filter: { userId: new mongoose.Types.ObjectId(req.userId!) }, // MUST filter by user!
        },
      },
      {
        // Only pass along the text we actually need to save bandwidth
        $project: {
          title: 1,
          description: 1,
          aiSummary: 1,
          metadata: 1,
          link: 1,
          score: { $meta: 'vectorSearchScore' }, // See how confident the AI was
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
      sources: relevantContent, // Send the sources back so the frontend can display clickable links!
    });
  } catch (error) {
    console.error('Vector search / Chat error:', error);
    res.status(500).json({
      message:
        'Internal server error during AI Search. Make sure your Atlas Vector Index is created!',
    });
  }
};
