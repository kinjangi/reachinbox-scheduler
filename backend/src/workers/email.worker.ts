import { Worker, Job, DelayedError } from 'bullmq';
import { EMAIL_QUEUE_NAME, EmailJobData } from '../queues/email.queue';
import { getRedisConnectionOptions } from '../config/redis';
import { config } from '../config/env';
import prisma from '../db';
import { EmailStatus } from '@prisma/client';
import { sendEmailViaEthereal } from '../services/mailer.service';
import { checkAndIncrementRateLimit } from '../services/rateLimiter.service';
import { notifySlackRateLimitHit } from '../services/slack.service';
import { indexEmailDocument } from '../services/elasticsearch.service';
import { eventBus } from '../services/eventBus.service';
import { emailsSentCounter, emailsFailedCounter } from '../routes/health.routes';

/**
 * BullMQ Worker for processing scheduled email jobs from 'email-queue'.
 */
export const emailWorker = new Worker<EmailJobData, void, string>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData, void, string>) => {
    const emailRecordId = job.data?.emailRecordId || job.id;

    if (!emailRecordId) {
      console.error(`[Worker] Job ${job.id} missing emailRecordId`);
      return;
    }

    console.log(`[Worker] Processing email job ${job.id} for email record: ${emailRecordId}`);

    // 1. Fetch email record from Database
    const email = await prisma.email.findUnique({
      where: { id: emailRecordId },
    });

    if (!email) {
      console.warn(`[Worker] Email record ${emailRecordId} not found in DB. Skipping.`);
      return;
    }

    // 2. Idempotency Guard: Skip if status is already "sent"
    if (email.status === EmailStatus.SENT) {
      console.log(
        `[Worker] [Idempotency Guard] Email record ${emailRecordId} is already marked as SENT. Skipping dispatch.`,
      );
      return;
    }

    // 3. Per-Sender Hourly Rate Limiting Guard
    const maxLimit = email.hourlyLimit || config.maxEmailsPerHourPerSender;
    const rateLimit = await checkAndIncrementRateLimit(email.senderEmail, maxLimit);

    if (!rateLimit.allowed) {

      console.warn(
        `[Worker] [Rate Limit Exceeded] Sender ${email.senderEmail} exceeded hourly limit (${maxLimit} emails/hr) on key '${rateLimit.key}'. ` +
          `Rescheduling job for record ${emailRecordId} to next hour window in ${rateLimit.delayUntilNextHourMs}ms.`,
      );

      // Trigger Slack notification if Slack integration exists (skips silently if absent)
      await notifySlackRateLimitHit({
        senderEmail: email.senderEmail,
        maxLimit,
        emailRecordId,
      });

      // Reschedule the current job into the next hour window using native BullMQ moveToDelayed.
      // This maintains the original jobId, preventing duplicates during server restart recovery.
      await job.moveToDelayed(Date.now() + rateLimit.delayUntilNextHourMs, job.token!);
      throw new DelayedError();
    }

    try {
      // 4. Dispatch Email via Ethereal SMTP
      await sendEmailViaEthereal({
        from: email.senderEmail,
        to: email.recipientEmail,
        subject: email.subject,
        body: email.body,
      });

      // 5. Update DB status to SENT with sent_time
      const updatedEmail = await prisma.email.update({
        where: { id: emailRecordId },
        data: {
          status: EmailStatus.SENT,
          sentTime: new Date(),
        },
      });

      // 6. Re-index in Elasticsearch to reflect updated SENT status
      await indexEmailDocument(updatedEmail);

      console.log(`[Worker] Successfully sent and updated email record ${emailRecordId} status to SENT.`);
    } catch (error) {
      console.error(`[Worker] Failed to send email record ${emailRecordId}:`, error);

      // Update DB status to FAILED (We will move this to a DLQ/Retry system in Phase 3)
      const failedEmail = await prisma.email.update({
        where: { id: emailRecordId },
        data: {
          status: EmailStatus.FAILED,
        },
      });

      // Re-index in Elasticsearch to reflect updated FAILED status
      await indexEmailDocument(failedEmail);

      // Rethrow error so BullMQ marks job as failed
      throw error;
    }
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: config.workerConcurrency,
    limiter: {
      max: 1,
      duration: config.minDelayMsBetweenSends,
    },
  },
);

// Worker Event Listeners for Logging
emailWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully.`);
  eventBus.emitUpdate('email_status_update', { emailId: job.data?.emailRecordId || job.id, status: 'SENT' });
  emailsSentCounter.inc();
});

emailWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed with error: ${err.message}`);
  if (!(err instanceof DelayedError)) {
    eventBus.emitUpdate('email_status_update', { emailId: job?.data?.emailRecordId || job?.id, status: 'FAILED' });
    emailsFailedCounter.inc();
  }
});
