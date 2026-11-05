import { HttpErrorResponse } from '@angular/common/http';

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

/** Normalised API error: `{ error: { code, message, details? } }` from the backend. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromBody(status: number, body: ApiErrorBody | null | undefined): ApiError {
    return new ApiError(
      status,
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.message ?? 'Something went wrong',
      body?.error?.details,
    );
  }

  static fromHttp(err: unknown): ApiError {
    if (err instanceof ApiError) return err;
    if (err instanceof HttpErrorResponse) return ApiError.fromBody(err.status, err.error as ApiErrorBody | null);
    return new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server');
  }
}
