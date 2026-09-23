import app from './app';
import { config } from './config/env';
import './workers/email.worker';
import { reconcileScheduledEmailJobs } from './services/queueRecovery.service';
import { ensureEmailIndexExists } from './services/elasticsearch.service';

const server = app.listen(config.port, async () => {
  console.log(`🚀 Server listening on http://localhost:${config.port}`);
  console.log(`🏥 Health check available at http://localhost:${config.port}/health`);

  // Initialize Elasticsearch index on startup
  try {
    await ensureEmailIndexExists();
  } catch (error) {
    console.warn('Elasticsearch index initialization skipped (service may be unavailable):', error);
  }

  // Run startup persistence check to restore any missing BullMQ jobs from DB
  try {
    await reconcileScheduledEmailJobs();
  } catch (error) {
    console.error('Failed to run startup queue persistence check:', error);
  }
});

// Handle graceful shutdown
const gracefulShutdown = () => {
  console.log('Received kill signal, shutting down gracefully...');
  server.close(() => {
    console.log('Closed remaining connections.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
