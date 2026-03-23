import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { signup, signin, demoLogin, getMe } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { message: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/signup', authLimiter, signup);
router.post('/signin', authLimiter, signin);
router.post('/demo-login', authLimiter, demoLogin);
router.get('/me', requireAuth, getMe);

export default router;
