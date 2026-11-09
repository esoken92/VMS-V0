'use server';

import { desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import { activityLogs, profiles } from '@/drizzle/schema';
import { requirePermission } from '@/lib/auth/session';
import { actionError, ok, type Result } from '@/lib/result';
import type { ActivityLogDTO } from '@/lib/types';

const impersonator = alias(profiles, 'impersonator');

/** Audit log — admin+ permission (`activity_logs:read`). */
export async function listActivityLogs(limit = 100): Promise<Result<ActivityLogDTO[]>> {
  try {
    await requirePermission('activity_logs:read');
    const rows = await db
      .select({
        id: activityLogs.id,
        user_id: activityLogs.userId,
        user_name: profiles.fullName,
        impersonated_by_name: impersonator.fullName,
        action: activityLogs.actionType,
        table_name: activityLogs.tableName,
        record_id: activityLogs.recordId,
        old_values: activityLogs.oldData,
        new_values: activityLogs.newData,
        ip_address: activityLogs.ipAddress,
        user_agent: activityLogs.userAgent,
        created_at: activityLogs.createdAt,
      })
      .from(activityLogs)
      .leftJoin(profiles, eq(activityLogs.userId, profiles.id))
      .leftJoin(impersonator, eq(activityLogs.impersonatedByUserId, impersonator.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(Math.min(Math.max(limit, 1), 500));

    return ok(
      rows.map((r) => ({
        ...r,
        created_at: r.created_at?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}
