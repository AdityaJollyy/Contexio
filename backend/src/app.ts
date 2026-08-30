import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import contentRoutes from './routes/content.routes.js';
import searchRoutes from './routes/search.routes.js';
import { contentQueue } from './queues/content.queue.js';
import { getErrorMessage } from './lib/errors.js';

const app = express();

// Behind a reverse proxy, X-Forwarded-For is where the real client IP is.
app.set('trust proxy', 1);

app.use(helmet());

// A disallowed origin is a client error, not a server fault. Without its own
// type it reaches the global handler as a generic Error and answers 500.
class CorsError extends Error {
  constructor() {
    super('Not allowed by CORS');
    this.name = 'CorsError';
  }
}

const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) || [];
app.use(
  cors({
    origin: (origin, callback) => {
      // No origin: native clients and curl.
      if (!origin) return callback(null, true);
      // Fails closed: an empty allow-list rejects every cross-origin request
      // rather than turning a missing env var into open CORS with credentials.
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new CorsError());
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req: Request, res: Response) => {
  const timestamp = new Date().toISOString();

  try {
    const queue = await contentQueue.getJobCounts();
    res.status(200).json({
      status: 'success',
      message: 'Contexio API is healthy',
      timestamp,
      queue,
    });
  } catch (error) {
    // A queue outage does not mean the API is down — saves fail, reads do not.
    console.error('Health check could not reach the queue:', getErrorMessage(error));
    res.status(200).json({
      status: 'degraded',
      message: 'Contexio API is up but the job queue is unreachable',
      timestamp,
    });
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/content', contentRoutes);
app.use('/api/v1/search', searchRoutes);

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof CorsError) {
    res.status(403).json({ message: err.message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Something went wrong' });
});

export default app;
