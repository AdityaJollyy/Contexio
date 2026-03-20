import { Router } from 'express';
import { regularSearch, chatWithBrain } from '../controllers/search.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth); // Protect all search routes

router.get('/', regularSearch); // GET /api/v1/search?query=hello
router.post('/chat', chatWithBrain); // POST /api/v1/search/chat

export default router;
