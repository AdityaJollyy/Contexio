import { type Response } from 'express';
import { z } from 'zod';
import { Content } from '../models/content.model.js';
import { type AuthRequest } from '../middlewares/auth.middleware.js';

// --- Zod Validation Schemas ---
const baseContentSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().optional().default(''),
  type: z.enum(['youtube', 'twitter', 'github', 'text', 'others']),
  link: z.string().optional(),
});

const createContentSchema = baseContentSchema.refine(
  (data) => {
    if (data.type !== 'text' && data.type !== 'others' && !data.link) {
      return false;
    }
    return true;
  },
  { message: 'A valid link is required', path: ['link'] }
);

const updateContentSchema = baseContentSchema.partial().refine(
  (data) => {
    if (data.type && data.type !== 'text' && data.type !== 'others' && !data.link) {
      return false;
    }
    return true;
  },
  { message: 'A valid link is required', path: ['link'] }
);

// --- Controller Functions ---

export const createContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsedBody = createContentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'Invalid input', errors: parsedBody.error });
      return;
    }

    const { title, description, type, link } = parsedBody.data;

    const newContent = await Content.create({
      title,
      description,
      type,
      link: link || '',
      userId: req.userId!,
      // ALL content starts as pending so the AI Worker can generate Vector Embeddings!
      status: 'pending',
    });

    res.status(201).json({
      message: 'Content created successfully. AI is processing it in the background.',
      content: newContent,
    });
  } catch (error) {
    console.error('Create content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getContents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const contents = await Content.find(
      { userId: req.userId! },
      {
        metadata: 0,
        aiSummary: 0,
        embedding: 0,
        __v: 0,
      }
    ).sort({ createdAt: -1 });

    res.status(200).json({ contents });
  } catch (error) {
    console.error('Get contents error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params as { contentId: string };

    const result = await Content.deleteOne({ _id: contentId as string, userId: req.userId! });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'Content not found or unauthorized' });
      return;
    }

    res.status(200).json({ message: 'Content successfully deleted' });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params as { contentId: string };

    const parsedBody = updateContentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'Invalid input', errors: parsedBody.error.format() });
      return;
    }

    const updatedContent = await Content.findOneAndUpdate(
      { _id: contentId as string, userId: req.userId! },
      {
        $set: {
          ...parsedBody.data,
          // ✅ FIX: If they update the content, we MUST reset the status so the AI worker recalculates the embedding!
          status: 'pending',
          retryCount: 0,
        },
      },
      { new: true }
    ).select('-metadata -aiSummary -embedding -__v');

    if (!updatedContent) {
      res.status(404).json({ message: 'Content not found or unauthorized' });
      return;
    }

    res.status(200).json({
      message: 'Content successfully updated. AI is recalculating context.',
      content: updatedContent,
    });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
