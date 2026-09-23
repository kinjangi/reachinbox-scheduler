import prisma from '../db';
import { EmailStatus } from '@prisma/client';
import { emailQueue, scheduleEmailJob } from '../queues/email.queue';

/**
 * Reconciles and synchronizes pending scheduled emails between PostgreSQL and BullMQ on server startup.
 * 
 * =========================================================================================
 * HOW THIS AVOIDS DUPLICATE SENDS (Three-Layer Idempotency Guard):
 * =========================================================================================
 * 
 * 1. PRE-CHECK VIA BullMQ GETJOB:
 *    Before adding any job to the queue, we call `await emailQueue.getJob(email.id)`.
 *    If a job already exists in Redis (whether in 'delayed', 'waiting', or 'active' state),
 *    we skip re-adding it entirely, avoiding redundant queue traffic.
 * 
 * 2. DETERMINISTIC BullMQ JOB ID (Redis-Level Deduplication):
 *    When `scheduleEmailJob` adds a delayed job to BullMQ, it explicitly specifies:
 *    `{ jobId: emailRecordId }`.
 *    BullMQ enforces uniqueness on the `jobId` string key in Redis. If a job with this ID
 *    already exists or was not removed, BullMQ's atomic Redis script will reject or ignore
 *    duplicate additions with the same ID, preventing two identical jobs from ever existing concurrently.
 * 
 * 3. DATABASE TRANSACTION & WORKER STATUS GUARD (Execution-Level Guard):
 *    Even in edge cases where a job is processed right as recovery runs, the worker
 *    (`email.worker.ts`) inspects the database record before dispatching the email:
 *    `if (email.status === EmailStatus.SENT) return;`
 *    Because the worker only flips status to 'SENT' alongside `sentTime` in the DB upon successful
 *    delivery, an already-sent email can never be dispatched a second time.
 * =========================================================================================
 */
export const reconcileScheduledEmailJobs = async (): Promise<{
  scanned: number;
  requeued: number;
  alreadyQueued: number;
}> => {
  const now = new Date();
  console.log(`[Startup Recovery] Checking DB for pending scheduled emails after ${now.toISOString()}...`);

  // Query DB for all pending emails scheduled in the future
  const pendingEmails = await prisma.email.findMany({
    where: {
      status: EmailStatus.PENDING,
      scheduledTime: {
        gt: now,
      },
    },
    orderBy: {
      scheduledTime: 'asc',
    },
  });

  let requeued = 0;
  let alreadyQueued = 0;

  for (const email of pendingEmails) {
    try {
      // Check if job is already present in BullMQ
      const existingJob = await emailQueue.getJob(email.id);

      if (existingJob) {
        const state = await existingJob.getState();
        // If the job is active, waiting, or delayed in BullMQ, leave it intact
        if (state === 'delayed' || state === 'waiting' || state === 'active') {
          alreadyQueued++;
          continue;
        }
      }

      // Job is missing from Redis (e.g. after Redis restart/flush). Re-enqueue with deterministic jobId.
      await scheduleEmailJob(email.id, email.scheduledTime);
      requeued++;
      console.log(
        `[Startup Recovery] Restored missing BullMQ job for email ${email.id} (Scheduled: ${email.scheduledTime.toISOString()})`,
      );
    } catch (err: any) {
      console.error(`[Startup Recovery] Error checking/restoring job for email ${email.id}:`, err?.message || err);
    }
  }

  console.log(
    `[Startup Recovery] Synchronization complete: ${pendingEmails.length} pending scanned, ` +
      `${requeued} re-enqueued, ${alreadyQueued} already present in queue.`,
  );

  return {
    scanned: pendingEmails.length,
    requeued,
    alreadyQueued,
  };
};
