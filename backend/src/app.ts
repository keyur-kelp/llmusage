import express, { Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { Sequelize } from 'sequelize';
import type { Logger } from 'pino';
import { Repositories, createRepositories } from './repositories';
import { AuthService } from './services/auth-service';
import { LlmGateway } from './services/llm-gateway';
import { QuotaService } from './services/quota-service';
import { RollupService } from './services/rollup-service';
import { SettingsService } from './services/settings-service';
import { UserService } from './services/user-service';
import { UsageReportService } from './services/usage-report-service';
import { ChatService } from './services/chat-service';
import { authenticate } from './middleware/authenticate';
import { requireAdmin } from './middleware/require-admin';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRoutes } from './routes/auth-routes';
import { modelRoutes } from './routes/model-routes';
import { ConversationService } from './services/conversation-service';
import { conversationRoutes } from './routes/conversation-routes';
import { chatRoutes } from './routes/chat-routes';
import { quotaRoutes } from './routes/quota-routes';
import { adminSettingsRoutes } from './routes/admin-settings-routes';
import { adminUserRoutes } from './routes/admin-user-routes';
import { adminUsageRoutes } from './routes/admin-usage-routes';

export interface AppDeps {
  sequelize: Sequelize;
  gateway: LlmGateway;
  jwtSecret: string;
  logger: Logger;
  now?: () => Date;
  /** Preferred picker default (env DEFAULT_MODEL); falls back to the first listed model. */
  defaultModel?: string;
}

export interface Services {
  repos: Repositories;
  auth: AuthService;
  quota: QuotaService;
  rollup: RollupService;
}

/** Wires repositories and services. Shared by createApp, the server entrypoint and the rollup CLI. */
export function buildServices(deps: Omit<AppDeps, 'gateway'>): Services {
  const repos = createRepositories(deps.sequelize);
  return {
    repos,
    auth: new AuthService(repos, deps.jwtSecret),
    quota: new QuotaService(repos, deps.now),
    rollup: new RollupService(deps.sequelize, repos, deps.logger, deps.now),
  };
}

export function createApp(deps: AppDeps): { app: Express; services: Services } {
  const services = buildServices(deps);
  const { repos, auth, quota, rollup } = services;
  const settings = new SettingsService(repos);
  const users = new UserService(repos);
  const report = new UsageReportService(repos, deps.now);
  const chat = new ChatService(deps.sequelize, repos, deps.gateway, quota, deps.logger, deps.now);

  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(pinoHttp({ logger: deps.logger }));
  app.use(express.json({ limit: '100kb' }));

  const api = express.Router();
  api.use('/auth', authRoutes(auth));

  const authed = express.Router();
  authed.use(authenticate(auth));
  authed.use('/models', modelRoutes(deps.gateway, deps.defaultModel));
  authed.use('/conversations', conversationRoutes(new ConversationService(repos)));
  authed.use('/chat', chatRoutes(chat));
  authed.use('/quota', quotaRoutes(quota));

  const admin = express.Router();
  admin.use(requireAdmin);
  admin.use('/settings', adminSettingsRoutes(settings));
  admin.use('/users', adminUserRoutes(users));
  admin.use('/', adminUsageRoutes(report, rollup));
  authed.use('/admin', admin);

  api.use(authed);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler(deps.logger));
  return { app, services };
}
