import { config } from '../config/env';
import prisma from '../db';

/**
 * Constructs Slack OAuth authorize URL for initiating user OAuth flow.
 */
export const getSlackOAuthUrl = (userId: string = 'default-user'): string => {
  const scope = 'incoming-webhook,chat:write';
  const state = encodeURIComponent(userId);
  const redirectUri = encodeURIComponent(config.slack.redirectUri);
  return `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
};

export interface SlackOAuthTokenResponse {
  ok: boolean;
  access_token?: string;
  scope?: string;
  user_id?: string;
  team?: { id: string; name: string };
  incoming_webhook?: {
    url: string;
    channel: string;
    channel_id: string;
    configuration_url: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  error?: string;
}

/**
 * Exchanges authorization code for Slack access token and incoming webhook URL.
 */
export const exchangeSlackCode = async (code: string): Promise<SlackOAuthTokenResponse> => {
  const params = new URLSearchParams();
  params.append('client_id', config.slack.clientId);
  params.append('client_secret', config.slack.clientSecret);
  params.append('code', code);
  params.append('redirect_uri', config.slack.redirectUri);

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = (await response.json()) as SlackOAuthTokenResponse;
  return data;
};

export interface SaveSlackIntegrationParams {
  userId: string;
  accessToken?: string | null;
  webhookUrl?: string | null;
}

/**
 * Persists or updates Slack Integration credentials in the database.
 */
export const saveSlackIntegration = async (params: SaveSlackIntegrationParams) => {
  const existing = await prisma.slackIntegration.findFirst({
    where: { userId: params.userId },
  });

  if (existing) {
    return prisma.slackIntegration.update({
      where: { id: existing.id },
      data: {
        accessToken: params.accessToken || existing.accessToken,
        webhookUrl: params.webhookUrl || existing.webhookUrl,
        connectedAt: new Date(),
      },
    });
  }

  return prisma.slackIntegration.create({
    data: {
      userId: params.userId,
      accessToken: params.accessToken,
      webhookUrl: params.webhookUrl,
    },
  });
};

export interface SlackNotificationParams {
  senderEmail: string;
  userId?: string;
  maxLimit: number;
  emailRecordId: string;
}

/**
 * Sends a Slack notification when a sender's rate limit is hit.
 * If no Slack integration exists for the sender/user, skips silently without throwing errors.
 */
export const notifySlackRateLimitHit = async (params: SlackNotificationParams): Promise<void> => {
  try {
    // 1. Look up Slack integration for the given userId or senderEmail
    const userKeys = [params.userId, params.senderEmail, 'default-user'].filter(Boolean) as string[];
    
    const integration = await prisma.slackIntegration.findFirst({
      where: {
        userId: { in: userKeys },
      },
      orderBy: { connectedAt: 'desc' },
    });

    // If no integration exists, skip silently without error
    if (!integration || (!integration.webhookUrl && !integration.accessToken)) {
      console.log(`[Slack] No active Slack integration found for ${params.senderEmail}. Skipping notification.`);
      return;
    }

    const message = `⚠️ *Rate Limit Alert*: Sender \`${params.senderEmail}\` exceeded hourly limit of *${params.maxLimit} emails/hr*.\n` +
      `Email record \`${params.emailRecordId}\` has been rescheduled to the next hour window.`;

    // 2. Dispatch via Webhook URL if available
    if (integration.webhookUrl) {
      const webhookRes = await fetch(integration.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });

      if (webhookRes.ok) {
        console.log(`[Slack] Successfully posted rate limit notification via Webhook for ${params.senderEmail}.`);
        return;
      }
    }

    // 3. Fallback to Slack Chat API if access token is available
    if (integration.accessToken) {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: 'general',
          text: message,
        }),
      });
      console.log(`[Slack] Successfully posted rate limit notification via API for ${params.senderEmail}.`);
    }
  } catch (error) {
    // Log warning and skip silently without breaking worker flow
    console.warn(`[Slack] Failed to send Slack notification for ${params.senderEmail}:`, error);
  }
};
