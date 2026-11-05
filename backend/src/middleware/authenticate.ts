import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AuthService } from '../services/auth-service';
import { User } from '../models';
import { unauthenticated } from '../lib/errors';

export function authenticate(auth: AuthService): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const match = /^Bearer (.+)$/i.exec(header);
    if (!match || !match[1]) throw unauthenticated();
    res.locals['user'] = await auth.authenticate(match[1]);
    next();
  };
}

export function currentUser(res: Response): User {
  return res.locals['user'] as User;
}
