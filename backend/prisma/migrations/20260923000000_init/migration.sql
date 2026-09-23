-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "sender_email" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scheduled_time" TIMESTAMP(3) NOT NULL,
    "delay_ms" INTEGER DEFAULT 0,
    "hourly_limit" INTEGER,
    "status" "EmailStatus" NOT NULL DEFAULT 'pending',
    "sent_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slack_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "webhook_url" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_integrations_pkey" PRIMARY KEY ("id")
);
