import mongoose from 'mongoose';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startWorker } from './worker.js';
import { getErrorMessage } from './lib/errors.js';

// Process state is unknown after either of these, so exit and let the
// supervisor restart rather than serve from a corrupted process.
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const startServer = async () => {
  try {
    await connectDB();

    const PORT = parseInt(env.PORT, 10);
    const server = app.listen(PORT, () => {
      console.log(`Server started on http://localhost:${PORT}`);
    });

    server.on('error', (error) => {
      console.error('Server failed to listen:', error);
      process.exit(1);
    });

    // Free hosting gives one always-on process, so the worker rides along here.
    // Set RUN_WORKER_IN_API=false and run `npm run start:worker` to split them.
    const worker = env.RUN_WORKER_IN_API === 'true' ? await startWorker() : null;
    if (worker) {
      console.log('Background worker started inside the API process');
    }

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`${signal} received, shutting down...`);
      server.close();
      if (worker) await worker.close();
      await mongoose.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
  } catch (error) {
    console.error('Failed to start the server:', getErrorMessage(error));
    process.exit(1);
  }
};

startServer();
