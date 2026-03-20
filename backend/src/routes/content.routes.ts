import { Router } from 'express';
import {
  createContent,
  getContents,
  deleteContent,
  updateContent,
} from '../controllers/content.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// ALL routes below this line will run through the requireAuth middleware first!
router.use(requireAuth);

router.post('/', createContent);
router.get('/', getContents);
router.delete('/:contentId', deleteContent); // :contentId is a dynamic URL parameter
router.put('/:contentId', updateContent);

export default router;
