import { Queue, Job } from 'bullmq';
import { getRedisConnectionOptions } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-queue';

export interface EmailJobData {
  emailRecordId: string;
}

// Initialize BullMQ email queue backed by Redis
export const emailQueue = new Queue<EmailJobData, any, string>(EMAIL_QUEUE_NAME, {
  connection: getRedisConnectionOptions(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // keep last 100 completed jobs
    removeOnFail: 500,     // keep last 500 failed jobs for debugging
  },
});

/**
 * Schedules an email job with BullMQ as a delayed job.
 * 
 * @param emailRecordId Unique ID of the email record in the DB (used as jobId for idempotency).
 * @param scheduledTime Target Date, ISO string, or timestamp when the email should be sent.
 * @returns The created BullMQ Job instance.
 */
export const scheduleEmailJob = async (
  emailRecordId: string,
  scheduledTime: Date | string | number,
): Promise<Job<EmailJobData, any, string>> => {
  const targetTimestamp = new Date(scheduledTime).getTime();
  const now = Date.now();
  const delay = Math.max(0, targetTimestamp - now);

  const job = await emailQueue.add(
    'send-email',
    { emailRecordId },
    {
      jobId: emailRecordId, // Idempotency key: prevents duplicate jobs for same email record
      delay,                // Native BullMQ delayed execution in milliseconds
    },
  );

  return job;
};
