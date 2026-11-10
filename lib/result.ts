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

  // DB driver errors (drizzle's FailedQuery dumps the full SQL + params into
  // err.message) must never reach the client — map known Postgres codes and
  // fall back to a generic message. postgres.js and PGlite both put the SQLSTATE
  // on `err.code` or on `err.cause.code`.
  const code =
    (err as { code?: string } | null | undefined)?.code ??
    (err as { cause?: { code?: string } } | null | undefined)?.cause?.code;
  if (
    code === '23505' ||
    /duplicate key value|violates unique constraint/i.test(message)
  ) {
    return fail('A record with this value already exists.', 'CONFLICT');
  }
  if (
    code === '23503' ||
    /violates foreign key constraint/i.test(message)
  ) {
    return fail(
      'This record is referenced by other data and cannot be changed.',
      'CONFLICT',
    );
  }
  if (code === '23502' || /violates not-null constraint/i.test(message)) {
    return fail('A required field is missing.', 'VALIDATION');
  }
  if (code || /^Failed query:/.test(message)) {
    console.error('[actionError] database error:', message.slice(0, 4000));
    return fail('A database error occurred. Please try again.');
  }
  return fail(message);
}
