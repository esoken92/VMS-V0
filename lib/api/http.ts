/**
 * lib/api/http — shared JSON envelope for the REST v1 + MCP surfaces.
 *
 * Success: the payload itself (or {data: ...} where a route chooses).
 * Failure: { error: { code, message } } — the contract documented in
 * public/llms.txt and /api/v1/openapi.json.
 *
 * ApiError is thrown anywhere inside handlers/data ops; `apiErrorResponse`
 * (and the `withApi` wrapper in lib/api/auth.ts) converts it — plus Zod
 * and unexpected errors — into that shape.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export type ApiErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'forbidden_scope'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'internal';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  forbidden_scope: 403,
  validation: 400,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status ?? STATUS_BY_CODE[code];
  }
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  init?: { status?: number; headers?: HeadersInit },
): NextResponse {
  return NextResponse.json(
    { error: { code, message } },
    { status: init?.status ?? STATUS_BY_CODE[code], headers: init?.headers },
  );
}

export function apiJson(
  data: unknown,
  init?: { status?: number; headers?: HeadersInit },
): NextResponse {
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers: init?.headers,
  });
}

/** Parse a request's JSON body; invalid/missing-JSON → 400 validation. */
export async function parseJsonBody(req: {
  json: () => Promise<unknown>;
}): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError('validation', 'Request body is not valid JSON');
  }
}

export function rateLimitedResponse(retryAfter: number): NextResponse {
  return apiError('rate_limited', 'Rate limit exceeded (60 requests/minute)', {
    headers: { 'Retry-After': String(retryAfter) },
  });
}

/** Convert thrown errors inside a handler to the error envelope. */
export function apiErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return apiError(err.code, err.message, { status: err.status });
  }
  if (err instanceof ZodError) {
    const issues = err.issues
      .map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`)
      .join('; ');
    return apiError('validation', `Invalid request body: ${issues}`);
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  return apiError('internal', message);
}
