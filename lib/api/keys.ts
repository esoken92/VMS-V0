/**
 * lib/api/keys — API key issuance + bearer-token resolution.
 *
 * Format: `vms_<48 base64url chars>` (36 random bytes → 48 chars). The
 * plaintext is shown ONCE at creation; the row stores:
 *   key_prefix — first 8 chars (display/identification)
 *   key_hash   — sha256(`${MCP_API_KEY_SALT}:${key}`) hex
 *
 * MCP_API_KEY_SALT is optional hardening (pepper) for network-exposed
 * installs — see docs/INTEGRATIONS.md §MCP. Keys are high-entropy
 * (288 bits) so a bare sha256 lookup is already safe against rainbow
 * tables; the salt additionally protects against a DB-only leak.
 * WARNING: changing the salt invalidates all previously issued keys.
 *
 * Hash lookup is indexed (key_hash unique) — equality on a digest, so no
 * timing-safe compare dance is needed.
 */

import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { profiles } from '@/drizzle/schema';
import { apiKeys, type ApiScope, isApiScope } from '@/drizzle/api-schema';
import type { UserRole } from '@/lib/auth/roles';
import { ApiError } from './http';

export const API_KEY_PREFIX = 'vms_';
const KEY_RANDOM_BYTES = 36; // → 48 base64url chars
export const API_KEY_RANDOM_CHARS = 48;

/** How often last_used_at is written (avoids a write per request). */
const LAST_USED_THROTTLE_MS = 60_000;

function hashKey(plaintext: string): string {
  const salt = process.env.MCP_API_KEY_SALT ?? '';
  return createHash('sha256').update(`${salt}:${plaintext}`).digest('hex');
}

export interface IssuedApiKey {
  id: string;
  /** Plaintext — returned to the caller once, then gone forever. */
  key: string;
  prefix: string;
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `${API_KEY_PREFIX}${randomBytes(KEY_RANDOM_BYTES).toString('base64url')}`;
  return {
    key,
    prefix: key.slice(0, API_KEY_PREFIX.length + 4), // 'vms_' + 4 chars = 8 total
    hash: hashKey(key),
  };
}

export interface ResolvedApiKey {
  keyId: string;
  name: string;
  scopes: ApiScope[];
  profileId: string;
  role: UserRole;
  fullName: string;
}

/**
 * Resolve a bearer token (`vms_…`) to its key row + owning profile.
 * Throws ApiError('unauthenticated') on unknown/revoked/expired keys.
 * Updates last_used_at at most once per minute per key.
 */
export async function resolveApiKey(token: string): Promise<ResolvedApiKey> {
  if (!token.startsWith(API_KEY_PREFIX)) {
    throw new ApiError('unauthenticated', 'Malformed API key');
  }
  const hash = hashKey(token);

  const rows = await db
    .select({
      keyId: apiKeys.id,
      name: apiKeys.name,
      scopes: apiKeys.scopes,
      revokedAt: apiKeys.revokedAt,
      expiresAt: apiKeys.expiresAt,
      lastUsedAt: apiKeys.lastUsedAt,
      profileId: profiles.id,
      role: profiles.role,
      fullName: profiles.fullName,
    })
    .from(apiKeys)
    .innerJoin(profiles, eq(apiKeys.userId, profiles.id))
    .where(eq(apiKeys.keyHash, hash))
    .limit(1);

  const row = rows[0];
  if (!row) throw new ApiError('unauthenticated', 'Invalid API key');
  if (row.revokedAt) throw new ApiError('unauthenticated', 'API key has been revoked');
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
    throw new ApiError('unauthenticated', 'API key has expired');
  }

  const scopes = row.scopes.filter(isApiScope);
  if (scopes.length === 0) {
    throw new ApiError('forbidden_scope', 'API key has no usable scopes');
  }

  // Throttled last_used_at touch (fire-and-forget; never blocks auth).
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, row.keyId))
      .then(() => undefined)
      .catch(() => undefined);
  }

  return {
    keyId: row.keyId,
    name: row.name,
    scopes,
    profileId: row.profileId,
    role: row.role,
    fullName: row.fullName,
  };
}

/** For docs/validation: active (non-revoked, non-expired) key predicate. */
export function activeKeyCondition() {
  return and(
    isNull(apiKeys.revokedAt),
    or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, sql`now()`)),
  );
}
