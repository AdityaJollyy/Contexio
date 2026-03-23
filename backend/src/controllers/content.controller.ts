import { type Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Content } from '../models/content.model.js';
import { type AuthRequest } from '../middlewares/auth.middleware.js';
import { processItem } from '../services/worker.service.js';
import { getErrorMessage } from '../lib/errors.js';

const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

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

export const createContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsedBody = createContentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'Invalid input', errors: parsedBody.error.format() });
      return;
    }

    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { title, description, type, link } = parsedBody.data;

    const newContent = await Content.create({
      title,
      description,
      type,
      link: link || '',
      userId: req.userId,
      status: 'pending',
    });

    // Process the item in the background (fire-and-forget)
    processItem(newContent._id).catch((err) => {
      console.error(`Background processing failed for ${newContent._id}:`, getErrorMessage(err));
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
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const contents = await Content.find(
      { userId: req.userId },
      { metadata: 0, aiSummary: 0, embedding: 0, __v: 0 }
    ).sort({ createdAt: -1 });

    res.status(200).json({ contents });
  } catch (error) {
    console.error('Get contents error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { contentId } = req.params;
    if (!contentId) {
      res.status(400).json({ message: 'Content ID is required' });
      return;
    }

    const result = await Content.deleteOne({ _id: contentId, userId: req.userId });

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
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { contentId } = req.params;
    if (!contentId) {
      res.status(400).json({ message: 'Content ID is required' });
      return;
    }

    const parsedBody = updateContentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'Invalid input', errors: parsedBody.error.format() });
      return;
    }

    // Check if content is currently being processed
    const existing = await Content.findOne({ _id: contentId, userId: req.userId });
    if (!existing) {
      res.status(404).json({ message: 'Content not found or unauthorized' });
      return;
    }

    if (existing.status === 'processing') {
      res.status(409).json({ message: 'Content is currently being processed. Please try again shortly.' });
      return;
    }

    const updatedContent = await Content.findOneAndUpdate(
      { _id: contentId, userId: req.userId },
      {
        $set: {
          ...parsedBody.data,
          status: 'pending',
          retryCount: 0,
          retryAfter: null,
        },
      },
      { returnDocument: 'after' }
    ).select('-metadata -aiSummary -embedding -__v');

    // Process the item in the background (fire-and-forget)
    if (updatedContent) {
      processItem(updatedContent._id).catch((err) => {
        console.error(`Background processing failed for ${updatedContent._id}:`, getErrorMessage(err));
      });
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
