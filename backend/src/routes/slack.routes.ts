import { Router } from 'express';
import { initiateSlackOAuth, handleSlackCallback } from '../controllers/slack.controller';

const router = Router();

// /auth/slack -> Initiates Slack OAuth redirect
router.get('/slack', initiateSlackOAuth);

// /auth/slack/callback -> Slack OAuth redirect callback
router.get('/slack/callback', handleSlackCallback);

export default router;
