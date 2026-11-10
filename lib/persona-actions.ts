'use server';

/**
 * "View as worker" preview — server actions that set/clear the
 * `vms_preview=operator` cookie consumed by middleware + the client nav.
 *
 * Kept outside lib/actions/ (frozen for this change); the cookie model
 * lives in lib/persona.ts, which stays edge-safe.
 */

import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth/session';
import {
  PREVIEW_COOKIE,
  PREVIEW_VALUE,
  canPreviewAsWorker,
} from '@/lib/persona';
import { actionError, fail, ok, type Result } from '@/lib/result';

/** Short-lived: the preview is for demos, not a persistent mode. */
const PREVIEW_MAX_AGE_SECONDS = 2 * 60 * 60; // 2h

export async function enterWorkerPreview(): Promise<Result<null>> {
  try {
    const ctx = await requireUser();
    // actor (real signed-in user) — admin/super_admin only, not manager,
    // and still honoured while impersonating.
    if (!canPreviewAsWorker(ctx.actor.role)) {
      return fail('Only admins can use worker preview', 'FORBIDDEN');
    }
    cookies().set(PREVIEW_COOKIE, PREVIEW_VALUE, {
      // NOT httpOnly — client components read it to render preview state.
      // It is downgrade-only: it can never widen what a request may do.
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: PREVIEW_MAX_AGE_SECONDS,
    });
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}

export async function exitWorkerPreview(): Promise<Result<null>> {
  try {
    await requireUser();
    cookies().delete(PREVIEW_COOKIE);
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
