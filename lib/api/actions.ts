'use server';

/**
 * lib/api/actions — server actions backing /dashboard/integrations.
 *
 * API keys are self-service: every signed-in user manages their OWN keys
 * (create / list / revoke). A key can never out-privilege its owner —
 * the role permission matrix is re-checked on every request — so there
 * is no admin approval step. The only gate at mint time is scope
 * selection: the 'admin' scope requires an admin/super_admin role,
 * because it unlocks the audit-log endpoint.
 *
 * The plaintext key is returned exactly once in the create response.
 */

import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { apiKeys } from '@/drizzle/api-schema';
import { setAuditContext } from '@/lib/db/context';
import { requireUser } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import { generateApiKey } from './keys';

export interface ApiKeyListItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string | null;
}

export async function listApiKeys(): Promise<Result<ApiKeyListItem[]>> {
  try {
    const ctx = await requireUser();
    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        key_prefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        last_used_at: apiKeys.lastUsedAt,
        expires_at: apiKeys.expiresAt,
        revoked_at: apiKeys.revokedAt,
        created_at: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.user.id))
      .orderBy(desc(apiKeys.createdAt))
      .limit(100);

    return ok(
      rows.map((r) => ({
        ...r,
        last_used_at: r.last_used_at?.toISOString() ?? null,
        expires_at: r.expires_at?.toISOString() ?? null,
        revoked_at: r.revoked_at?.toISOString() ?? null,
        created_at: r.created_at?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  scopes: z.array(z.enum(['read', 'write', 'admin'])).min(1).max(3),
  /** Days until expiry; null/absent = never expires. */
  expires_in_days: z.number().int().min(1).max(3650).nullable().optional(),
});

const ADMIN_SCOPE_ROLES = ['super_admin', 'admin'] as const;

export async function createApiKey(input: unknown): Promise<
  Result<{ id: string; key: string; key_prefix: string }>
> {
  try {
    const ctx = await requireUser();
    const data = createSchema.parse(input);

    // 'admin' scope unlocks /api/v1/audit — admin roles only.
    if (
      data.scopes.includes('admin') &&
      !ADMIN_SCOPE_ROLES.includes(ctx.user.role as (typeof ADMIN_SCOPE_ROLES)[number])
    ) {
      return fail(
        "The 'admin' scope requires an admin or super_admin role",
        'FORBIDDEN',
      );
    }

    const { key, prefix, hash } = generateApiKey();
    const expiresAt =
      data.expires_in_days != null
        ? new Date(Date.now() + data.expires_in_days * 864e5)
        : null;

    const [row] = await db
      .insert(apiKeys)
      .values({
        userId: ctx.user.id,
        name: data.name,
        keyPrefix: prefix,
        keyHash: hash,
        scopes: data.scopes,
        expiresAt,
      })
      .returning({ id: apiKeys.id });

    return ok({ id: row.id, key, key_prefix: prefix });
  } catch (err) {
    return actionError(err);
  }
}

export async function revokeApiKey(id: string): Promise<Result<null>> {
  try {
    const ctx = await requireUser();
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) return fail('Invalid key id', 'VALIDATION');

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const updated = await tx
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiKeys.id, parsed.data), eq(apiKeys.userId, ctx.user.id)))
        .returning({ id: apiKeys.id });
      if (updated.length === 0) throw new Error('API key not found');
    });
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
