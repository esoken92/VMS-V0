/**
 * lib/api/handler — the withApi() wrapper every /api/v1 route uses:
 *
 *   resolveApiPrincipal  (Bearer key → session cookie)
 *   → checkRateLimit     (60 req/min per key / per session user)
 *   → requireApiScope    (read | write | admin from the credential)
 *   → handler(req, principal, ctx)
 *
 * All failures become the { error: { code, message } } envelope via
 * apiErrorResponse — Zod errors → 400 validation, ApiError → its status,
 * anything else → 500 internal.
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { ApiScope } from '@/drizzle/api-schema';
import {
  rateLimitKey,
  requireApiScope,
  resolveApiPrincipal,
  type ApiPrincipal,
} from './auth';
import { apiErrorResponse, rateLimitedResponse } from './http';
import { checkRateLimit, rateLimitHeaders } from './ratelimit';

export interface RouteContext {
  params: Record<string, string>;
}

type ApiHandler = (
  req: NextRequest,
  principal: ApiPrincipal,
  ctx: RouteContext,
) => Promise<NextResponse> | NextResponse;

export function withApi(scope: ApiScope, handler: ApiHandler) {
  return async function routeHandler(
    req: NextRequest,
    ctx: RouteContext,
  ): Promise<NextResponse> {
    try {
      const principal = await resolveApiPrincipal(req);

      const rate = checkRateLimit(rateLimitKey(principal));
      if (!rate.allowed) {
        return rateLimitedResponse(rate.retryAfter);
      }

      requireApiScope(principal, scope);
      const res = await handler(req, principal, ctx);
      for (const [k, v] of Object.entries(rateLimitHeaders(rate))) {
        res.headers.set(k, v);
      }
      return res;
    } catch (err) {
      return apiErrorResponse(err);
    }
  };
}
