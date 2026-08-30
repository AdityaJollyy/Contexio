import { Router } from 'express';
import { regularSearch, chatWithBrain, getQuota } from '../controllers/search.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { searchLimiter } from '../middlewares/rate-limit.middleware.js';
import { env } from '../config/env.js';

const router = Router();

router.use(requireAuth); // Protect all search routes

// The AI route has the daily quota; plain search only needs a script guard.
router.get('/', searchLimiter(env.PLAIN_SEARCH_RATE_MAX), regularSearch); // GET /api/v1/search?query=hello
router.get('/quota', getQuota); // GET /api/v1/search/quota
router.post('/chat', chatWithBrain); // POST /api/v1/search/chat

export default router;
