import { NextFunction, Request, Response } from 'express';
import { currentUser } from './authenticate';
import { forbidden } from '../lib/errors';

export function requireAdmin(_req: Request, res: Response, next: NextFunction): void {
  if (currentUser(res).role !== 'ADMIN') throw forbidden('Admin access required');
  next();
}
