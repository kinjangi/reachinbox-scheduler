# ReachInbox Scheduler

A production-ready, full-stack email scheduling platform built with **Express + TypeScript**, **Next.js 14**, **BullMQ**, **PostgreSQL**, **Redis**, and **Elasticsearch** — featuring Slack OAuth, per-sender rate limiting, a live queue dashboard, and Google OAuth login.

---

## 📦 Monorepo Structure

```
reachinbox-scheduler/
├── docker-compose.yml       # PostgreSQL 15, Redis 7, Elasticsearch 8
├── README.md
├── backend/                 # Express + TypeScript API + BullMQ Worker
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema (Email, SlackIntegration)
│   │   └── migrations/      # SQL migration files
│   └── src/
│       ├── config/          # env.ts, redis.ts, bullBoard.ts
│       ├── controllers/     # email.controller.ts, slack.controller.ts, health.controller.ts
│       ├── db/              # Prisma client singleton
│       ├── queues/          # email.queue.ts (BullMQ Queue + scheduleEmailJob)
│       ├── routes/          # email.routes.ts, slack.routes.ts, health.routes.ts
│       ├── services/        # mailer, rateLimiter, slack, elasticsearch, queueRecovery
│       └── workers/         # email.worker.ts
└── frontend/                # Next.js 14 (App Router) + Tailwind + NextAuth
    └── src/
        ├── app/             # pages, layout, providers, API routes
        ├── components/
        │   ├── ui/          # Button, Input, Textarea, Modal, Table
        │   ├── Header.tsx
        │   └── ComposeModal.tsx
        └── lib/
            └── api.ts       # Typed API client with toast error handling
```

---

## 🚀 How to Run and Test This Project (Reviewer Guide)

### 1. Initial Setup
Clone the repository and configure the environment variables:
```bash
# Setup backend environment
cp backend/.env.example backend/.env
# (Optional) Edit backend/.env to add your SLACK_CLIENT_ID, etc.

# Setup frontend environment
cp frontend/.env.example frontend/.env.local
```

### 2. Start the Entire Stack via Docker
The provided `docker-compose.yml` is configured to boot **everything**: Postgres, Redis, Elasticsearch, the Node.js Backend, and the Next.js Frontend.

```bash
docker-compose up -d --build
```
*Wait ~10-15 seconds for the database and Elasticsearch to initialize.*
- **Frontend** runs on `http://localhost:3000`
- **Backend API** runs on `http://localhost:4000`
- **BullMQ Dashboard** runs on `http://localhost:4000/admin/queues`

### 3. Test 1: Verify Scheduling & Constraints
Open your browser to `http://localhost:3000` and use the "Compose" modal to schedule emails. Alternatively, use the API directly to simulate a high-volume load that hits the rate limit:

```bash
# Schedule 20 emails with a strict hourly limit of 5
curl -X POST http://localhost:4000/emails/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "senderEmail": "test-sender@reachinbox.com",
    "subject": "E2E Test",
    "body": "Testing rate limit",
    "recipients": ["user1@x.com", "user2@x.com", "user3@x.com", "user4@x.com", "user5@x.com", "user6@x.com", "user7@x.com", "user8@x.com", "user9@x.com", "user10@x.com"],
    "delay": 0,
    "hourlyLimit": 5
  }'
```
**Verification:**
- Open `http://localhost:4000/admin/queues` in your browser.
- You will see the first 5 jobs process sequentially (with a `1000ms` delay between them).
- The 6th to 10th jobs will instantly move to the **Delayed** tab, safely scheduled for the next hour window!

### 4. Test 2: Restart Persistence & Idempotency
With jobs waiting in the "Delayed" queue, kill and restart the backend container to simulate a crash:

```bash
# Restart the backend container
docker-compose restart backend
```
**Verification:**
- Check the BullMQ dashboard again.
- The `queueRecovery.service.ts` will run on boot. It will scan the database for pending emails, detect that the delayed jobs already exist in Redis, and **prevent duplicates**. 
- The exact number of delayed jobs will remain perfectly intact. None are lost, and none are sent twice.

### 5. Test 3: Slack Notification
When the rate limit was hit in Test 1, the backend automatically attempted to send a Slack notification via the webhook URL stored for `test-sender@reachinbox.com`. 
- To see the actual outgoing payload in the terminal logs, run:
```bash
docker-compose logs backend | grep -i "Rate Limit"
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Express server port |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/reachinbox_db` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `WORKER_CONCURRENCY` | `5` | Max concurrent BullMQ worker jobs |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Per-sender hourly send cap |
| `MIN_DELAY_MS_BETWEEN_SENDS` | `1000` | Minimum ms between consecutive sends (BullMQ limiter) |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch endpoint |
| `ELASTICSEARCH_INDEX` | `emails` | Index name for email documents |
| `SLACK_CLIENT_ID` | _(required for Slack OAuth)_ | Slack App client ID |
| `SLACK_CLIENT_SECRET` | _(required for Slack OAuth)_ | Slack App client secret |
| `SLACK_REDIRECT_URI` | `http://localhost:4000/auth/slack/callback` | Slack OAuth callback URL |
| `SMTP_HOST` | `smtp.ethereal.email` | SMTP host (Ethereal auto-created if blank) |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | _(optional)_ | SMTP username |
| `SMTP_PASS` | _(optional)_ | SMTP password |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend API base URL |
| `GOOGLE_CLIENT_ID` | _(required)_ | Google OAuth App client ID |
| `GOOGLE_CLIENT_SECRET` | _(required)_ | Google OAuth App client secret |
| `NEXTAUTH_URL` | `http://localhost:3000` | NextAuth base URL |
| `NEXTAUTH_SECRET` | _(required)_ | Random secret for JWT encryption |

---

## 🐳 Running via Docker Compose

To run the full stack (backend + frontend + infrastructure):

```bash
# Start all infrastructure services
docker-compose up -d

# Backend
cd backend && npm install && npm run prisma:generate && npm run dev

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

> **Tip:** To extend `docker-compose.yml` with the backend/frontend as additional services, add Node.js service blocks with `Dockerfile` build contexts.

---

## 📋 API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/emails/schedule` | Schedule emails (array/CSV recipients) |
| `GET` | `/emails/scheduled` | List pending scheduled emails |
| `GET` | `/emails/sent` | List sent emails |
| `GET` | `/emails/search?q=` | Elasticsearch full-text search |
| `GET` | `/auth/slack` | Initiate Slack OAuth |
| `GET` | `/auth/slack/callback` | Slack OAuth callback |
| `GET` | `/admin/queues` | Bull Board live dashboard |

---

## ⏱️ Minimum Delay Between Sends

**Chosen value: `1000 ms` (`MIN_DELAY_MS_BETWEEN_SENDS`)**

### Implementation

Enforced via BullMQ's native **`limiter`** option on the worker:

```typescript
new Worker(EMAIL_QUEUE_NAME, processor, {
  connection: getRedisConnectionOptions(),
  concurrency: config.workerConcurrency,
  limiter: {
    max: 1,
    duration: config.minDelayMsBetweenSends, // 1 job per 1000ms
  },
});
```

### Why 1000ms?

- **Spam filter avoidance**: Most ESPs (e.g. SendGrid, Mailgun) flag burst sends from a single origin IP. A 1-second gap gives the upstream SMTP server a natural "cool down" window.
- **Configurable**: Change via `MIN_DELAY_MS_BETWEEN_SENDS` without redeploying. High-volume senders can lower it to `200`–`500 ms`; cautious senders can raise it to `3000`–`5000 ms`.
- **Redis-backed atomicity**: BullMQ implements the limiter via Lua scripts in Redis, making it safe across multiple concurrent worker processes with no race conditions.

---

## 🔄 How Rate Limiting Works

### 1. Per-Sender Hourly Cap

Before dispatching each email, the worker executes an atomic `INCR`/`EXPIRE` sequence in Redis:

```
Key:   ratelimit:{senderEmail}:{YYYY-MM-DDTHH}
Value: incremented integer (email count for this hour window)
TTL:   3600 seconds (auto-expires at the top of the next hour)
```

**Workflow:**
1. `INCR key` → returns new count
2. If `count === 1`: `EXPIRE key 3600` (set TTL only on first use)
3. If `count > maxLimit`: `DECR key` (revert — the blocked send doesn't consume quota) → reschedule job to the start of the **next** hour window via a new BullMQ delayed job
4. If Slack integration exists for the sender: post a rate-limit alert

**Critical property**: If a job is rescheduled due to rate limiting, the DB record stays `PENDING` — it is **never** marked `FAILED`.

### 2. Minimum Delay Between Sends (BullMQ Limiter)

Layered on top of hourly caps, the BullMQ worker `limiter` ensures no two emails are dispatched within `MIN_DELAY_MS_BETWEEN_SENDS` of each other, regardless of sender.

### 3. Idempotency Guards (3 layers)

| Layer | Mechanism |
|---|---|
| **BullMQ Job ID** | `jobId = email.id` — Redis deduplicates, rejects duplicate enqueues |
| **Queue pre-check** | Startup recovery checks `emailQueue.getJob(email.id)` before re-adding |
| **Worker DB check** | Before sending, worker queries DB: skips if `status === 'SENT'` |

---

## ⚖️ Trade-offs & Design Decisions

### BullMQ Delayed Jobs vs. Cron
**Chosen**: BullMQ native `delay` option.
- ✅ No cron dependency; delay computed as `scheduledTime - Date.now()`
- ✅ Survives Redis restarts via startup reconciliation
- ⚠️ Requires `MIN_DELAY_MS >= 0`; negative delays default to immediate execution

### Prisma vs. Drizzle
**Chosen**: Prisma.
- ✅ First-class TypeScript support, auto-generated types, migration tooling
- ⚠️ Slightly heavier client bundle vs. Drizzle; Drizzle would be better at extreme query volumes

### Elasticsearch vs. PostgreSQL Full-Text Search
**Chosen**: Elasticsearch for search, PostgreSQL as source of truth.
- ✅ Fuzzy matching, field boosting, highlighted snippets out of the box
- ⚠️ Requires sync discipline: indexing happens at creation + every status change in the worker. A write failure to ES is logged but non-fatal (data is always recoverable from Postgres).

### Ethereal SMTP (Development)
- Auto-creates a test account if `SMTP_USER`/`SMTP_PASS` are blank — zero-config for development
- Replace with real credentials (SendGrid, AWS SES) for production

### Redis as Rate-Limit Store
- Redis `INCR` is atomic by design; no mutex or distributed lock needed
- TTL-based expiry (`EXPIRE 3600`) means no manual cleanup or cron job to prune counters
- Trade-off: if Redis is flushed, rate-limit windows reset (acceptable — it errs on the side of sending more, not less)
