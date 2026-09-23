import { Request, Response } from 'express';

export const getHealthStatus = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    message: 'ReachInbox Scheduler API is operational',
    timestamp: new Date().toISOString(),
    service: 'reachinbox-scheduler-backend',
  });
};
