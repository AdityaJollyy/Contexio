import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import contentRoutes from './routes/content.routes.js';
import searchRoutes from './routes/search.routes.js';

const app = express();

// Global Middlewares
app.use(express.json({ limit: '1mb' })); // Parses incoming JSON payloads
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
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/search', searchRoutes);

// Global error handler — must have 4 params for Express to recognise it
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Something went wrong' });
});

export default app;
