import { Request, Response } from 'express';
import { getSlackOAuthUrl, exchangeSlackCode, saveSlackIntegration } from '../services/slack.service';
import { config } from '../config/env';

/**
 * Initiates Slack OAuth flow by redirecting user to Slack authorize URL.
 */
export const initiateSlackOAuth = (req: Request, res: Response): void => {
  if (!config.slack.clientId) {
    res.status(500).json({
      error: 'Slack OAuth is not configured. Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in .env.',
    });
    return;
  }

  const userId = (req.query.userId as string) || 'default-user';
  const redirectUrl = getSlackOAuthUrl(userId);
  res.redirect(redirectUrl);
};

/**
 * Handles Slack OAuth callback endpoint (/auth/slack/callback).
 */
export const handleSlackCallback = async (req: Request, res: Response): Promise<void> => {
  const code = req.query.code as string;
  const state = (req.query.state as string) || 'default-user';
  const errorParam = req.query.error as string;

  if (errorParam) {
    res.status(400).json({
      error: `Slack OAuth Access Denied: ${errorParam}`,
    });
    return;
  }

  if (!code) {
    res.status(400).json({
      error: 'Missing authorization code from Slack callback.',
    });
    return;
  }

  try {
    const tokenResult = await exchangeSlackCode(code);

    if (!tokenResult.ok) {
      res.status(400).json({
        error: tokenResult.error || 'Failed to exchange authorization code for Slack token.',
        details: tokenResult,
      });
      return;
    }

    const webhookUrl = tokenResult.incoming_webhook?.url || null;
    const accessToken = tokenResult.access_token || tokenResult.authed_user?.access_token || null;

    const integration = await saveSlackIntegration({
      userId: state,
      accessToken,
      webhookUrl,
    });

    res.status(200).json({
      status: 'success',
      message: 'Slack integration connected successfully!',
      integration: {
        id: integration.id,
        userId: integration.userId,
        hasWebhook: !!integration.webhookUrl,
        hasAccessToken: !!integration.accessToken,
        connectedAt: integration.connectedAt,
      },
    });
  } catch (err: any) {
    console.error('Slack OAuth Callback Error:', err);
    res.status(500).json({
      error: 'Internal server error during Slack OAuth callback processing.',
      details: err?.message || err,
    });
  }
};
