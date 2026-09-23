import { Request, Response } from 'express';
import { searchEmails, indexEmailDocument } from '../services/elasticsearch.service';
import prisma from '../db';
import { scheduleEmailJob } from '../queues/email.queue';
import { EmailStatus, Email } from '@prisma/client';
import { eventBus } from '../services/eventBus.service';

// ─── Shared Response Types ────────────────────────────────────────────────────

export interface EmailRecord {
  id: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledTime: string;
  delayMs: number | null;
  hourlyLimit: number | null;
  status: string;
  sentTime: string | null;
  createdAt: string;
}

export interface ScheduleEmailResult {
  emailId: string;
  recipientEmail: string;
  jobId: string | undefined;
}

export interface ScheduleEmailsResponse {
  status: 'success';
  scheduled: ScheduleEmailResult[];
  total: number;
}

export interface ListEmailsResponse {
  emails: EmailRecord[];
  total: number;
}

export interface SearchEmailsResponse {
  query: string;
  total: number;
  results: Array<{
    id: string;
    sender: string;
    recipient: string;
    subject: string;
    status: string;
    score?: number;
    highlight?: Record<string, string[]>;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toEmailRecord = (email: Email): EmailRecord => ({
  id: email.id,
  senderEmail: email.senderEmail,
  recipientEmail: email.recipientEmail,
  subject: email.subject,
  body: email.body,
  scheduledTime: email.scheduledTime.toISOString(),
  delayMs: email.delayMs,
  hourlyLimit: email.hourlyLimit,
  status: email.status,
  sentTime: email.sentTime ? email.sentTime.toISOString() : null,
  createdAt: email.createdAt.toISOString(),
});

/**
 * Parses a recipients value that can be:
 *  - A string (single email or comma-separated list)
 *  - An array of strings
 * Returns a deduplicated, trimmed array of email strings.
 */
const parseRecipients = (recipients: string | string[] | undefined): string[] => {
  if (!recipients) return [];
  const arr = Array.isArray(recipients) ? recipients : [recipients];
  return [...new Set(arr.flatMap((r) => r.split(',').map((e) => e.trim()).filter(Boolean)))];
};

// ─── POST /emails/schedule ────────────────────────────────────────────────────

/**
 * POST /emails/schedule
 * Creates one DB record per recipient and schedules a BullMQ delayed job for each.
 *
 * Body:
 *   senderEmail    string         required
 *   subject        string         required
 *   body           string         required
 *   recipients     string|string[] required — single email, CSV, or array
 *   startTime      string         optional ISO date; defaults to now + delayMs
 *   delayMs        number         optional — additional per-job delay offset (ms)
 *   hourlyLimit    number         optional — per-sender hourly cap stored on each record
 */
export const scheduleEmailsHandler = async (
  req: Request<object, ScheduleEmailsResponse, {
    senderEmail: string;
    subject: string;
    body: string;
    recipients: string | string[];
    startTime?: string;
    delayMs?: number;
    hourlyLimit?: number;
  }>,
  res: Response<ScheduleEmailsResponse | { error: string; details?: string }>,
): Promise<void> => {
  const { senderEmail, subject, body, recipients, startTime, delayMs = 0, hourlyLimit } = req.body;

  // Validate required fields
  if (!senderEmail || !subject || !body || !recipients) {
    res.status(400).json({
      error: 'Missing required fields: senderEmail, subject, body, recipients',
    });
    return;
  }

  const recipientList = parseRecipients(recipients);
  if (recipientList.length === 0) {
    res.status(400).json({ error: 'recipients must contain at least one valid email address.' });
    return;
  }

  // Compute base schedule time: startTime (if given) + delayMs offset
  const baseTime = startTime ? new Date(startTime).getTime() : Date.now();
  const targetTime = new Date(baseTime + delayMs);

  try {
    const scheduled: ScheduleEmailResult[] = [];

    for (const recipientEmail of recipientList) {
      // 1. Persist email record to PostgreSQL
      const email = await prisma.email.create({
        data: {
          senderEmail,
          recipientEmail,
          subject,
          body,
          scheduledTime: targetTime,
          delayMs,
          hourlyLimit: hourlyLimit ?? null,
          status: EmailStatus.PENDING,
        },
      });

      // 2. Index immediately in Elasticsearch (status = pending)
      await indexEmailDocument(email);

      // 3. Enqueue BullMQ delayed job using email.id as idempotent jobId
      const job = await scheduleEmailJob(email.id, targetTime);

      const scheduledItem = { emailId: email.id, recipientEmail, jobId: job.id };
      scheduled.push(scheduledItem);
      
      // Emit event for real-time dashboard updates
      eventBus.emitUpdate('email_scheduled', scheduledItem);
    }

    res.status(201).json({
      status: 'success',
      scheduled,
      total: scheduled.length,
    });
  } catch (error: any) {
    console.error('[POST /emails/schedule] Error:', error);
    res.status(500).json({
      error: 'Failed to schedule one or more emails.',
      details: error?.message || String(error),
    });
  }
};

// ─── GET /emails/scheduled ────────────────────────────────────────────────────

/**
 * GET /emails/scheduled
 * Returns all emails with status PENDING and scheduledTime in the future.
 *
 * Optional query params:
 *   page     number (default 1)
 *   limit    number (default 50)
 *   sender   string filter by senderEmail
 */
export const getScheduledEmailsHandler = async (
  req: Request,
  res: Response<ListEmailsResponse | { error: string }>,
): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
  const sender = (req.query.sender as string) || undefined;

  try {
    const [emails, total] = await prisma.$transaction([
      prisma.email.findMany({
        where: {
          status: EmailStatus.PENDING,
          scheduledTime: { gt: new Date() },
          ...(sender ? { senderEmail: sender } : {}),
        },
        orderBy: { scheduledTime: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.email.count({
        where: {
          status: EmailStatus.PENDING,
          scheduledTime: { gt: new Date() },
          ...(sender ? { senderEmail: sender } : {}),
        },
      }),
    ]);

    res.status(200).json({
      emails: emails.map(toEmailRecord),
      total,
    });
  } catch (error: any) {
    console.error('[GET /emails/scheduled] Error:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled emails.' });
  }
};

// ─── GET /emails/sent ─────────────────────────────────────────────────────────

/**
 * GET /emails/sent
 * Returns all emails with status SENT, ordered by sentTime descending.
 *
 * Optional query params:
 *   page     number (default 1)
 *   limit    number (default 50)
 *   sender   string filter by senderEmail
 */
export const getSentEmailsHandler = async (
  req: Request,
  res: Response<ListEmailsResponse | { error: string }>,
): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
  const sender = (req.query.sender as string) || undefined;

  try {
    const [emails, total] = await prisma.$transaction([
      prisma.email.findMany({
        where: {
          status: EmailStatus.SENT,
          ...(sender ? { senderEmail: sender } : {}),
        },
        orderBy: { sentTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.email.count({
        where: {
          status: EmailStatus.SENT,
          ...(sender ? { senderEmail: sender } : {}),
        },
      }),
    ]);

    res.status(200).json({
      emails: emails.map(toEmailRecord),
      total,
    });
  } catch (error: any) {
    console.error('[GET /emails/sent] Error:', error);
    res.status(500).json({ error: 'Failed to fetch sent emails.' });
  }
};

// ─── GET /emails/search ───────────────────────────────────────────────────────

/**
 * GET /emails/search?q=...
 * Searches emails across subject and recipient fields via Elasticsearch.
 */
export const searchEmailsHandler = async (
  req: Request,
  res: Response<SearchEmailsResponse | { error: string; details?: string }>,
): Promise<void> => {
  const query = (req.query.q as string)?.trim();

  if (!query) {
    res.status(400).json({
      error: 'Missing required query parameter `q`. Example: /emails/search?q=invoice',
    });
    return;
  }

  try {
    const results = await searchEmails(query);
    res.status(200).json({ query, total: results.length, results });
  } catch (error: any) {
    console.error('[GET /emails/search] Error:', error);
    res.status(500).json({
      error: 'Failed to execute email search.',
      details: error?.message || String(error),
    });
  }
};

/**
 * GET /emails/failed
 * Returns all emails with status FAILED, ordered by scheduledTime descending.
 */
export const getFailedEmailsHandler = async (
  req: Request,
  res: Response<ListEmailsResponse | { error: string }>,
): Promise<void> => {
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
  const sender = (req.query.sender as string) || undefined;

  try {
    const [emails, total] = await prisma.$transaction([
      prisma.email.findMany({
        where: {
          status: EmailStatus.FAILED,
          ...(sender ? { senderEmail: sender } : {}),
        },
        orderBy: { scheduledTime: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.email.count({
        where: {
          status: EmailStatus.FAILED,
          ...(sender ? { senderEmail: sender } : {}),
        },
      }),
    ]);

    res.status(200).json({
      emails: emails.map(toEmailRecord),
      total,
    });
  } catch (error: any) {
    console.error('[GET /emails/failed] Error:', error);
    res.status(500).json({ error: 'Failed to fetch failed emails.' });
  }
};

/**
 * POST /emails/:id/retry
 * Retries a permanently failed email by resetting its status to PENDING and re-enqueuing it.
 */
export const retryEmailHandler = async (
  req: Request<{ id: string }>,
  res: Response<{ status: string; message: string; jobId?: string } | { error: string }>,
): Promise<void> => {
  const { id } = req.params;

  try {
    const email = await prisma.email.findUnique({ where: { id } });

    if (!email) {
      res.status(404).json({ error: 'Email record not found' });
      return;
    }

    if (email.status !== EmailStatus.FAILED) {
      res.status(400).json({ error: 'Only failed emails can be retried' });
      return;
    }

    // Reset status to pending
    const updatedEmail = await prisma.email.update({
      where: { id },
      data: {
        status: EmailStatus.PENDING,
        sentTime: null,
      },
    });

    // Re-index
    await indexEmailDocument(updatedEmail);

    // Enqueue
    const job = await scheduleEmailJob(id, Date.now());

    // Emit event
    eventBus.emitUpdate('email_scheduled', { emailId: id, recipientEmail: email.recipientEmail, jobId: job.id });

    res.status(200).json({
      status: 'success',
      message: 'Email successfully queued for retry',
      jobId: job.id,
    });
  } catch (error: any) {
    console.error(`[POST /emails/${id}/retry] Error:`, error);
    res.status(500).json({ error: 'Failed to retry email.' });
  }
};
