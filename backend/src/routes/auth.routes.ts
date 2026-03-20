import { Router } from 'express';
import { signup, signin, demoLogin } from '../controllers/auth.controller.js';

const router = Router();

// Define routes and attach their controller functions
router.post('/signup', signup);
router.post('/signin', signin);
router.post('/demo-login', demoLogin);

export default router;
