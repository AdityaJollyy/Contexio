import { type Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Content } from '../models/content.model.js';
import { type AuthRequest } from '../middlewares/auth.middleware.js';
import { Chunk } from '../models/chunk.model.js';
import { enqueueContent } from '../queues/content.queue.js';
import { env } from '../config/env.js';

const isValidObjectId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

const baseContentSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().optional().default(''),
  type: z.enum(['youtube', 'twitter', 'github', 'text', 'others']),
  // The link is rendered as an href and fetched server-side, so the scheme is
  // constrained here rather than at either call site.
  link: z
    .string()
    .trim()
    .refine((value) => value === '' || /^https?:\/\//i.test(value), {
      message: 'Link must be an http or https URL',
    })
    .optional(),
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

    // The backstop on a shared API key: every save costs a generate call and an
    // embed call, so one bulk import would spend the day for every user.
    const itemCount = await Content.countDocuments({ userId: req.userId });
    if (itemCount >= env.MAX_ITEMS_PER_USER) {
      res.status(400).json({
        message: `You've reached the ${env.MAX_ITEMS_PER_USER.toLocaleString('en-US')} item limit. Delete something to save more.`,
      });
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

    // Awaited: if Redis is down the save fails loudly rather than dropping work.
    await enqueueContent(newContent._id.toString());

    const content = await Content.findById(newContent._id, {
      metadata: 0,
      aiSummary: 0,
      __v: 0,
    }).lean();

    res.status(201).json({
      message: 'Content created successfully. AI is processing it in the background.',
      content,
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
      { metadata: 0, aiSummary: 0, __v: 0 }
    )
      .sort({ createdAt: -1 })
      .lean();

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
    if (typeof contentId !== 'string' || !isValidObjectId(contentId)) {
      res.status(400).json({ message: 'A valid content ID is required' });
      return;
    }

    const result = await Content.deleteOne({ _id: contentId, userId: req.userId });

    if (result.deletedCount === 0) {
      res.status(404).json({ message: 'Content not found or unauthorized' });
      return;
    }

    await Chunk.deleteMany({ contentId, userId: req.userId });

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
    if (typeof contentId !== 'string' || !isValidObjectId(contentId)) {
      res.status(400).json({ message: 'A valid content ID is required' });
      return;
    }

    const parsedBody = updateContentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'Invalid input', errors: parsedBody.error.format() });
      return;
    }

    // The 'processing' guard is in the filter, not a preceding read: a worker
    // can start a job between a check and a separate update.
    const updatedContent = await Content.findOneAndUpdate(
      { _id: contentId, userId: req.userId, status: { $ne: 'processing' } },
      {
        $set: {
          ...parsedBody.data,
          status: 'pending',
        },
      },
      { returnDocument: 'after' }
    ).select('-metadata -aiSummary -__v');

    if (!updatedContent) {
      const exists = await Content.exists({ _id: contentId, userId: req.userId });
      if (!exists) {
        res.status(404).json({ message: 'Content not found or unauthorized' });
        return;
      }
      res
        .status(409)
        .json({ message: 'Content is currently being processed. Please try again shortly.' });
      return;
    }

    await enqueueContent(updatedContent._id.toString());

    res.status(200).json({
      message: 'Content successfully updated. AI is recalculating context.',
      content: updatedContent,
    });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Re-queues an item the worker gave up on. Only the owner, and only a failed
 * item: re-running a ready one spends a Gemini call rebuilding what exists, and
 * re-running a pending one duplicates a queued job.
 */
export const retryContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { contentId } = req.params;
    if (typeof contentId !== 'string' || !isValidObjectId(contentId)) {
      res.status(400).json({ message: 'A valid content ID is required' });
      return;
    }

    const item = await Content.findOne({ _id: contentId, userId: req.userId });
    if (!item) {
      res.status(404).json({ message: 'Content not found' });
      return;
    }

    if (item.status !== 'failed') {
      res.status(400).json({ message: 'This item does not need retrying.' });
      return;
    }

    const updated = await Content.findByIdAndUpdate(
      item._id,
      { $set: { status: 'pending', failureReason: '' }, $inc: { manualRetries: 1 } },
      { returnDocument: 'after', projection: { metadata: 0, aiSummary: 0, __v: 0 } }
    ).lean();

    await enqueueContent(item._id.toString());

    res.status(200).json({ message: 'Retrying now.', content: updated });
  } catch (error) {
    console.error('Retry content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
