/**
 * lib/db/context — transaction-scoped actor context for the DB audit triggers.
 *
 * The audit_trigger_func (002_audit_triggers.sql) attributes activity_logs
 * rows by reading these custom settings at write time:
 *   - request.jwt.claim.sub       → activity_logs.user_id
 *   - app.impersonated_by         → activity_logs.impersonated_by_user_id
 *   - request.headers.x-client-ip → activity_logs.ip_address
 *   - request.headers.x-user-agent→ activity_logs.user_agent
 *
 * Supabase used to populate them from the JWT; on plain Postgres the app sets
 * them via set_config(..., is_local := true) at the start of every mutating
 * transaction — call `withAuditContext(tx)` once inside db.transaction()
 * before the first write.
 */

import { sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import type { db } from './index';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AuditActor {
  /** Effective profile id the write is attributed to (impersonation-aware). */
  userId: string;
  /** Impersonating admin's profile id, when in impersonation mode. */
  impersonatorId?: string | null;
}

function safeRequestHeader(name: string): string {
  try {
    // headers() throws outside a request context (e.g. seed script, jobs).
    return headers().get(name) ?? '';
  } catch {
    return '';
  }
}

/**
 * Set actor settings inside an open transaction. Cheap (4 set_config calls).
 */
export async function setAuditContext(tx: Tx, actor: AuditActor) {
  const ip =
    safeRequestHeader('x-forwarded-for').split(',')[0]?.trim() ??
    safeRequestHeader('x-real-ip');
  const ua = safeRequestHeader('user-agent');

  await tx.execute(sql`SELECT set_config('request.jwt.claim.sub', ${actor.userId}, true)`);
  await tx.execute(
    sql`SELECT set_config('app.impersonated_by', ${actor.impersonatorId ?? ''}, true)`,
  );
  await tx.execute(sql`SELECT set_config('request.headers.x-client-ip', ${ip ?? ''}, true)`);
  await tx.execute(sql`SELECT set_config('request.headers.x-user-agent', ${ua ?? ''}, true)`);
}
