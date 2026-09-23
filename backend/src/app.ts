import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config/env';
import { createBullBoardRouter } from './config/bullBoard';
import healthRoutes from './routes/health.routes';
import slackRoutes from './routes/slack.routes';
import emailRoutes from './routes/email.routes';
import eventsRoutes from './routes/events.routes';

const app: Express = express();

// Security and utility middleware
app.use(helmet({
  // Bull Board loads its own static assets; relax CSP for the admin path only
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging with Pino
app.use(pinoHttp({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
}));

// Bull Board live queue dashboard at /admin/queues
app.use('/admin/queues', createBullBoardRouter());

// Health Check Routes
app.use('/', healthRoutes);
app.use('/api', healthRoutes);

// Slack OAuth Routes (/auth/slack & /auth/slack/callback)
app.use('/auth', slackRoutes);

// Email Routes (/emails/search, /emails)
app.use('/emails', emailRoutes);

// Realtime Event Stream Route
app.use('/events', eventsRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
