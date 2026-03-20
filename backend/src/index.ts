import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';

const startServer = async () => {
  try {
    // Connect to the database
    await connectDB();

    const PORT = parseInt(env.PORT, 10);
    app.listen(PORT, () => {
      console.log(`Server successfully started on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

startServer();
