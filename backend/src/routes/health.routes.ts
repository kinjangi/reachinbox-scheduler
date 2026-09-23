import { Router } from 'express';
import { getHealthStatus } from '../controllers/health.controller';
import client from 'prom-client';

const router = Router();

// Setup default metrics collection
client.collectDefaultMetrics();

// Define custom metrics
export const emailsSentCounter = new client.Counter({
  name: 'emails_sent_total',
  help: 'Total number of successfully sent emails',
});

export const emailsFailedCounter = new client.Counter({
  name: 'emails_failed_total',
  help: 'Total number of permanently failed emails',
});

router.get('/health', getHealthStatus);

router.get('/metrics', async (_req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
});

export default router;
