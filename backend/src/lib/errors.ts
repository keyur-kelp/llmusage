export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Not found'): AppError => new AppError('NOT_FOUND', 404, message);
export const unauthenticated = (message = 'Authentication required'): AppError =>
  new AppError('UNAUTHENTICATED', 401, message);
export const forbidden = (message = 'Forbidden'): AppError => new AppError('FORBIDDEN', 403, message);
