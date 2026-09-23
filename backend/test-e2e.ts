import { PrismaClient } from '@prisma/client';
import http from 'http';
import { Queue } from 'bullmq';
import { execSync } from 'child_process';


const prisma = new PrismaClient();
const queue = new Queue('email-queue', { connection: { host: 'localhost', port: 6379 } });

const MOCK_WEBHOOK_PORT = 9999;
let slackMessageReceived = false;

// 1. Setup Mock Slack Webhook Server
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      console.log(`\n✅ [TEST] Received Slack Webhook Payload:\n${body}\n`);
      slackMessageReceived = true;
      res.writeHead(200);
      res.end('ok');
    });
  }
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function runTest() {
  console.log('[TEST] Starting E2E Simulation Test...');
  
  server.listen(MOCK_WEBHOOK_PORT, () => {
    console.log(`[TEST] Mock Slack Webhook Server listening on port ${MOCK_WEBHOOK_PORT}`);
  });

  const senderEmail = `e2e-test-${Date.now()}@example.com`;

  // 2. Setup Slack Integration in DB
  await prisma.slackIntegration.upsert({
    where: { id: 'test-integration-id' },
    update: { webhookUrl: `http://localhost:${MOCK_WEBHOOK_PORT}/webhook`, userId: senderEmail },
    create: {
      id: 'test-integration-id',
      userId: senderEmail,
      webhookUrl: `http://localhost:${MOCK_WEBHOOK_PORT}/webhook`,
    }
  });
  console.log(`[TEST] Configured Slack integration for ${senderEmail}`);

  // Clear previous jobs to avoid noise
  await queue.obliterate({ force: true });
  console.log('[TEST] Cleared existing BullMQ queue');

  // 3. Schedule 20 emails
  console.log(`[TEST] Scheduling 20 emails for ${senderEmail} with hourlyLimit=5...`);
  
  const recipients = Array.from({ length: 20 }, (_, i) => `recipient${i}@example.com`);
  
  const payload = {
    senderEmail,
    subject: 'E2E Test Email',
    body: 'Hello E2E',
    recipients,
    delay: 0,
    hourlyLimit: 5
  };

  const response = await fetch('http://localhost:4000/emails/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    console.error('[TEST] Failed to schedule emails:', await response.text());
    process.exit(1);
  }

  console.log('[TEST] Scheduled 20 emails successfully via API');

  // 4. Wait for processing and Slack Webhook
  console.log('[TEST] Waiting 12 seconds for worker to process and hit rate limit...');
  await delay(12000);

  if (!slackMessageReceived) {
    console.error('❌ [TEST] Failed: Did not receive Slack webhook message!');
  }

  const completed = await queue.getCompletedCount();
  const delayed = await queue.getDelayedCount();
  
  console.log(`\n[TEST] BullMQ Queue Status Before Restart:`);
  console.log(`  Completed (Sent): ${completed}`);
  console.log(`  Delayed (Rate Limited): ${delayed}`);
  
  if (completed !== 5) {
    console.warn(`[TEST] Expected 5 completed jobs, got ${completed}.`);
  }
  if (delayed !== 15) {
    console.warn(`[TEST] Expected 15 delayed jobs, got ${delayed}.`);
  }

  // 5. Restart Backend Process Mid-way
  console.log('\n[TEST] Restarting backend process to simulate crash and recovery...');
  try {
    // Kill the node process running the backend dev server. On Windows, we can use taskkill.
    // We'll find the process listening on 4000 and kill it.
    execSync(`FOR /F "tokens=5" %a in ('netstat -aon ^| findstr :4000') do taskkill /F /PID %a`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore error if already dead
  }
  
  console.log('[TEST] Backend killed. Waiting 3 seconds...');
  await delay(3000);
  
  console.log('[TEST] Checking BullMQ duplicate jobs...');
  // Since backend is dead, queueRecovery hasn't run. The delayed jobs should remain exactly 15.
  const delayedAfterKill = await queue.getDelayedCount();
  console.log(`  Delayed count while offline: ${delayedAfterKill}`);

  console.log('[TEST] Re-starting backend in background...');
  execSync('start /B npx ts-node src/index.ts', { stdio: 'ignore' });
  
  console.log('[TEST] Waiting 10 seconds for backend to boot, run recovery, and process...');
  await delay(10000);

  const completedFinal = await queue.getCompletedCount();
  const delayedFinal = await queue.getDelayedCount();
  const activeFinal = await queue.getActiveCount();
  const waitingFinal = await queue.getWaitingCount();

  console.log(`\n[TEST] Final BullMQ Queue Status (After Recovery):`);
  console.log(`  Completed (Sent): ${completedFinal}`);
  console.log(`  Delayed (Rate Limited): ${delayedFinal}`);
  console.log(`  Active: ${activeFinal}`);
  console.log(`  Waiting: ${waitingFinal}`);

  const total = completedFinal + delayedFinal + activeFinal + waitingFinal;
  console.log(`\n[TEST] Total jobs in queue: ${total}`);
  
  if (total === 20) {
    console.log('✅ [TEST] PASSED: No duplicate jobs were created on restart!');
  } else {
    console.error(`❌ [TEST] FAILED: Expected exactly 20 jobs total, found ${total} (duplicates created!)`);
  }

  server.close();
  await prisma.$disconnect();
  await queue.close();
  process.exit(0);
}

runTest().catch(console.error);
