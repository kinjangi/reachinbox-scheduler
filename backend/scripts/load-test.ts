const API_URL = 'http://localhost:4000';
const ENDPOINT = `${API_URL}/emails/schedule`;
const BATCH_SIZE = 50;
const TOTAL_EMAILS = 1000;
const SENDER = 'loadtest@example.com';

async function runLoadTest() {
  console.log(`Starting load test: Sending ${TOTAL_EMAILS} emails in batches of ${BATCH_SIZE}...`);
  const startTime = Date.now();
  
  let successes = 0;
  let failures = 0;
  let totalApiTime = 0;

  for (let i = 0; i < TOTAL_EMAILS; i += BATCH_SIZE) {
    const promises = [];
    const batchStartTime = Date.now();

    for (let j = 0; j < BATCH_SIZE && i + j < TOTAL_EMAILS; j++) {
      const payload = {
        senderEmail: SENDER,
        subject: `Load Test Email ${i + j}`,
        body: `This is a test email for load testing. Index: ${i + j}`,
        recipients: [`recipient${i + j}@example.com`]
      };

      promises.push(
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(res => res.json())
      );
    }

    const results = await Promise.all(promises);
    const batchTime = Date.now() - batchStartTime;
    totalApiTime += batchTime;

    results.forEach((res: any) => {
      if (res.status === 'success') successes++;
      else failures++;
    });

    console.log(`Batch ${i / BATCH_SIZE + 1} completed in ${batchTime}ms`);
  }

  const totalTime = Date.now() - startTime;
  console.log('\n--- Load Test Results ---');
  console.log(`Total Emails Sent: ${TOTAL_EMAILS}`);
  console.log(`Successes: ${successes}`);
  console.log(`Failures: ${failures}`);
  console.log(`Total Time: ${totalTime}ms`);
  console.log(`Avg API Latency per Batch: ${totalApiTime / Math.ceil(TOTAL_EMAILS / BATCH_SIZE)}ms`);
  console.log('-------------------------\n');
}

runLoadTest().catch(console.error);
