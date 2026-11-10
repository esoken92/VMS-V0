/**
 * lib/api/auth — request authentication for /api/v1 and /api/mcp.
 *
 * Two credentials are accepted, resolved in this order:
 *   1. `Authorization: Bearer vms_…` — a scoped API key (api_keys table).
 *       The caller gets the key's scopes; the owning profile's role still
 *       governs via the permission matrix (a read-scoped staff key can
 *       never out-privilege staff).
 *   2. Auth.js session cookie — browser/agent requests authenticated like
 *       the dashboard, resolved through the same currentUser() helper the
 *       server actions use (impersonation-aware). Session callers are
 *       implicitly fully scoped (read+write+admin); the role matrix
 *       remains the real gate.
 *
 * NEVER trust scope claims from the client: scopes come from the DB row
 * (keys) or are derived server-side (session), then `requireApiScope`
 * enforces read/write/admin before any DB work.
 */

import type { NextRequest } from 'next/server';
import { currentUser } from '@/lib/auth/session';
import type { UserRole } from '@/lib/auth/roles';
import { API_SCOPES, type ApiScope } from '@/drizzle/api-schema';
import { ApiError } from './http';
import { resolveApiKey } from './keys';

export interface ApiPrincipal {
  /** Effective profile id (impersonation target when impersonating). */
  profileId: string;
  role: UserRole;
  fullName: string;
  /** Scopes the *credential* grants — key row or full set for sessions. */
  scopes: ApiScope[];
  via: 'key' | 'session';
  /** Set for key auth; null for session auth. */
  keyId: string | null;
  keyName: string | null;
  /** Impersonating admin's profile id (session auth only). */
  impersonatorId: string | null;
}

/** Enforce that the credential carries `scope`. Never role-trusting. */
export function requireApiScope(principal: ApiPrincipal, scope: ApiScope): void {
  if (!principal.scopes.includes(scope)) {
    throw new ApiError(
      'forbidden_scope',
      `This credential lacks the '${scope}' scope`,
    );
  }
}

/** Rate-limit bucket key — per API key, or per user for sessions. */
export function rateLimitKey(principal: ApiPrincipal): string {
  return principal.via === 'key'
    ? `key:${principal.keyId}`
    : `session:${principal.profileId}`;
}

/** Build a principal from the Auth.js session (impersonation-aware). */
async function sessionPrincipal(): Promise<ApiPrincipal | null> {
  const ctx = await currentUser();
  if (!ctx) return null;
  return {
    profileId: ctx.user.id,
    role: ctx.user.role,
    fullName: ctx.user.fullName,
    scopes: [...API_SCOPES],
    via: 'session',
    keyId: null,
    keyName: null,
    impersonatorId: ctx.impersonating ? ctx.actor.id : null,
  };
}

/**
 * Resolve the request's principal. Bearer key wins over the session
 * cookie; throws ApiError('unauthenticated') when neither is valid.
 */
export async function resolveApiPrincipal(req: NextRequest): Promise<ApiPrincipal> {
  const header = req.headers.get('authorization');
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (!match) throw new ApiError('unauthenticated', 'Malformed Authorization header');
    const resolved = await resolveApiKey(match[1].trim());
    return {
      profileId: resolved.profileId,
      role: resolved.role,
      fullName: resolved.fullName,
      scopes: resolved.scopes,
      via: 'key',
      keyId: resolved.keyId,
      keyName: resolved.name,
      impersonatorId: null,
    };
  }

  const sessionCtx = await sessionPrincipal();
  if (sessionCtx) return sessionCtx;

  throw new ApiError(
    'unauthenticated',
    'Provide an Authorization: Bearer vms_… API key or a signed-in session',
  );
}
