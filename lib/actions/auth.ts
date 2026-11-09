'use server';

/**
 * Auth-related server actions: signup, password reset stub, password change.
 *
 * NOTE on password reset: no email provider is wired yet (see
 * docs/INTEGRATIONS.md — Resend is opt-in via RESEND_API_KEY). Until then the
 * reset flow is a "contact your administrator" placeholder, matching the
 * framework-integration pattern: feature detects missing env and degrades.
 */

import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { authUsers, profiles } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requireUser } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';

const signupSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  full_name: z.string().trim().min(2).max(200),
});

/** Public self-signup — creates auth.users + profiles rows (role: staff). */
export async function signupUser(input: unknown): Promise<Result<{ id: string }>> {
  try {
    const data = signupSchema.parse(input);
    const email = data.email.toLowerCase().trim();

    const existing = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.email, email))
      .limit(1);
    if (existing.length > 0) {
      return fail('An account with this email already exists', 'CONFLICT');
    }

    const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });

    const created = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(authUsers)
        .values({ email, emailConfirmedAt: new Date() })
        .returning({ id: authUsers.id });

      await tx.insert(profiles).values({
        id: u.id, // profiles.id == auth.users.id convention
        userId: u.id,
        fullName: data.full_name,
        role: 'staff',
        passwordHash,
      });
      return u;
    });

    return ok({ id: created.id });
  } catch (err) {
    return actionError(err);
  }
}

const resetRequestSchema = z.object({ email: z.string().email().max(320) });

/**
 * Password reset — placeholder until an email provider is configured.
 * Always returns the same message (no account enumeration).
 */
export async function requestPasswordReset(input: unknown): Promise<Result<{ message: string }>> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return fail('Please enter a valid email', 'VALIDATION');

  if (!process.env.RESEND_API_KEY) {
    return ok({
      message:
        'Email is not configured on this instance — ask your administrator to reset your password.',
    });
  }
  // TODO(INTEGRATIONS): send reset email via Resend once wired.
  return ok({
    message:
      'Email is not configured on this instance — ask your administrator to reset your password.',
  });
}

const changePasswordSchema = z.object({
  new_password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

/** Change own password while signed in. */
export async function changeMyPassword(input: unknown): Promise<Result<null>> {
  try {
    const ctx = await requireUser();
    const data = changePasswordSchema.parse(input);
    const passwordHash = await argon2.hash(data.new_password, { type: argon2.argon2id });

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx
        .update(profiles)
        .set({ passwordHash })
        .where(eq(profiles.id, ctx.user.id));
    });

    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
