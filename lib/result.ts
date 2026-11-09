/**
 * Shared Result<T> returned by every server action.
 * Never throw across the action boundary — return `fail(message)` and let the
 * UI render it. `code` lets pages special-case auth errors if needed.
 */

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'CONFLICT' | 'NOT_FOUND' | 'VALIDATION' };

export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

export function fail<T = never>(
  error: string,
  code?: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'CONFLICT' | 'NOT_FOUND' | 'VALIDATION',
): Result<T> {
  return { success: false, error, ...(code ? { code } : {}) };
}

/** Thrown by lib/auth helpers; converted to Result by `actionError`. */
export class AuthError extends Error {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN';
  constructor(code: 'UNAUTHENTICATED' | 'FORBIDDEN', message: string) {
    super(message);
    this.code = code;
  }
}

/** Convert thrown errors (incl. AuthError, ZodError) into a failed Result. */
export function actionError<T = never>(err: unknown): Result<T> {
  if (err instanceof AuthError) {
    return fail(err.message, err.code);
  }
  if (err instanceof Error && err.name === 'ZodError') {
    return fail(`Invalid input: ${err.message}`, 'VALIDATION');
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  return fail(message);
}
