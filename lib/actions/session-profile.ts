'use server';

/**
 * Session profile payload consumed by the client AuthProvider.
 * Returns the effective profile (impersonation-aware) + actor identity.
 */

import { currentUser, toProfileDTO } from '@/lib/auth/session';
import { ok, type Result } from '@/lib/result';
import type { SessionProfileResponse } from '@/lib/types';

export async function getSessionProfile(): Promise<Result<SessionProfileResponse | null>> {
  const ctx = await currentUser();
  if (!ctx) return ok(null);

  return ok({
    user: { id: ctx.actor.id, email: ctx.actor.email },
    profile: toProfileDTO(ctx.user),
    impersonation: ctx.impersonating
      ? {
          active: true,
          session_id: ctx.impersonationSessionId ?? undefined,
          target_profile: toProfileDTO(ctx.user),
          impersonator: { id: ctx.actor.id, full_name: ctx.actor.fullName },
        }
      : null,
  });
}
