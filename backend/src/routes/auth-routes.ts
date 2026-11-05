import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth-service';
import { authenticate, currentUser } from '../middleware/authenticate';
import { validateBody } from '../middleware/validate';
import { toUserDto } from '../services/user-dto';

const loginSchema = z.object({ email: z.string().min(1).max(320), password: z.string().min(1).max(200) });

export function authRoutes(auth: AuthService): Router {
  const r = Router();
  r.post('/login', validateBody(loginSchema), async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    res.json(await auth.login(email, password));
  });
  r.get('/me', authenticate(auth), (_req, res) => {
    res.json(toUserDto(currentUser(res)));
  });
  return r;
}
