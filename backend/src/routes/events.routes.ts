import { Router, Request, Response } from 'express';
import { eventBus } from '../services/eventBus.service';

const router = Router();

router.get('/stream', (req: Request, res: Response) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Write initial connection payload
  res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE connection established' })}\n\n`);

  // Define listener function
  const onUpdate = (eventPayload: any) => {
    res.write(`data: ${JSON.stringify(eventPayload)}\n\n`);
  };

  // Subscribe to EventBus
  eventBus.on('update', onUpdate);

  // Clean up when client disconnects
  req.on('close', () => {
    eventBus.off('update', onUpdate);
  });
});

export default router;
