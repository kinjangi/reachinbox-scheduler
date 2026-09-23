import { Router } from 'express';
import {
  scheduleEmailsHandler,
  getScheduledEmailsHandler,
  getSentEmailsHandler,
  searchEmailsHandler,
  getFailedEmailsHandler,
  retryEmailHandler,
} from '../controllers/email.controller';

const router = Router();

// POST /emails/schedule -> Create DB records + BullMQ jobs for each recipient
router.post('/schedule', scheduleEmailsHandler);

// GET /emails/scheduled -> All PENDING emails with future scheduledTime
router.get('/scheduled', getScheduledEmailsHandler);

// GET /emails/sent -> All SENT emails ordered by sentTime desc
router.get('/sent', getSentEmailsHandler);

// GET /emails/failed -> All FAILED emails
router.get('/failed', getFailedEmailsHandler);

// POST /emails/:id/retry -> Retry a FAILED email
router.post('/:id/retry', retryEmailHandler);

// GET /emails/search?q= -> Full-text Elasticsearch search across subject and recipient
router.get('/search', searchEmailsHandler);

export default router;
