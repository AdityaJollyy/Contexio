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
    // Only validate if type is present
    if (data.type && data.type !== 'text' && data.type !== 'others' && !data.link) {
      return false;
    }
    return true;
  },
  { message: 'A valid link is required', path: ['link'] }
); // All fields optional for update, but if type is provided, link must be valid

// --- Controller Functions ---

export const createContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsedBody = createContentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'Invalid input', errors: parsedBody.error });
      return;
    }

    const { title, description, type, link } = parsedBody.data;
    const isTextContent = type === 'text' || type === 'others';

    const newContent = await Content.create({
      title,
      description,
      type,
      ...(link !== undefined ? { link } : { link: 'https://text-note.local' }),
      userId: req.userId!,
      status: isTextContent ? 'ready' : 'pending',
    });

    // TODO: We will trigger our Background Worker here for AI embeddings!

    res.status(201).json({
      message: 'Content created successfully',
      content: newContent,
    });
  } catch (error) {
    console.error('Create content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getContents = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Fetch all content for this specific user
    const contents = await Content.find(
      { userId: req.userId! },
      {
        // 1 means "include this field", 0 means "exclude it"
        // We explicitly EXCLUDE internal AI fields so the frontend payload is fast and clean
        metadata: 0,
        aiSummary: 0,
        embedding: 0,
        __v: 0,
      }
    ).sort({ createdAt: -1 }); // Sort newest first

    res.status(200).json({ contents });
  } catch (error) {
    console.error('Get contents error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteContent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params as { contentId: string };;

    // Guard against malformed IDs before hitting the DB
    if (!/^[a-f\d]{24}$/i.test(contentId)) {
      res.status(400).json({ message: 'Invalid content ID' });
      return;
    }

    // Ensure the content belongs to the user trying to delete it!
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
    const { contentId } = req.params as { contentId: string };;

    // Guard against malformed IDs before hitting the DB
    if (!/^[a-f\d]{24}$/i.test(contentId)) {
      res.status(400).json({ message: 'Invalid content ID' });
      return;
    }

    const parsedBody = updateContentSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ message: 'Invalid input', errors: parsedBody.error.format() });
      return;
    }

    // Find and update, ensuring the user owns the content
    const updatedContent = await Content.findOneAndUpdate(
      { _id: contentId as string, userId: req.userId! },
      { $set: parsedBody.data },
      { new: true } // Return the updated document instead of the old one
    ).select('-metadata -aiSummary -embedding -__v');

    if (!updatedContent) {
      res.status(404).json({ message: 'Content not found or unauthorized' });
      return;
    }

    res.status(200).json({
      message: 'Content successfully updated',
      content: updatedContent,
    });
  } catch (error) {
    console.error('Update content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
