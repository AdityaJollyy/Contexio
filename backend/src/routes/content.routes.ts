import { Router } from 'express';
import {
  createContent,
  getContents,
  deleteContent,
  updateContent,
  retryContent,
} from '../controllers/content.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { contentWriteLimiter } from '../middlewares/rate-limit.middleware.js';
import { env } from '../config/env.js';

const router = Router();

router.use(requireAuth);

// Writes cost a Gemini call each; reads cost nothing and stay unlimited.
const writeLimiter = contentWriteLimiter(env.CONTENT_WRITE_RATE_MAX);

router.post('/', writeLimiter, createContent);
router.get('/', getContents);
router.delete('/:contentId', writeLimiter, deleteContent); // :contentId is a dynamic URL parameter
router.put('/:contentId', writeLimiter, updateContent);
router.post('/:contentId/retry', writeLimiter, retryContent);

export default router;
