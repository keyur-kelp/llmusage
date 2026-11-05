import pino, { Logger, DestinationStream } from 'pino';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.password_hash',
  '*.token',
  'password',
  'token',
];

export function createLogger(level: string, destination?: DestinationStream): Logger {
  return pino(
    { level, redact: { paths: REDACT_PATHS, censor: '[REDACTED]' } },
    destination,
  );
}
