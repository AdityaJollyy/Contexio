import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import contentRoutes from './routes/content.routes.js';

const app = express();

// Global Middlewares
app.use(express.json()); // Parses incoming JSON payloads
app.use(cors()); // Allows the React frontend to make requests to this API

// Health Check Route (To verify the server is running)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    message: 'Second Brain API is perfectly healthy!',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/content', contentRoutes); // Mount the content routes

export default app;
