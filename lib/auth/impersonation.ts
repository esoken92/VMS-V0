/**
 * Impersonation cookie — a short-lived HS256 JWT recording that a
 * super_admin is viewing the app as another user.
 *
 * Why a signed cookie (not just a session-id cookie): middleware needs the
 * *effective* role for route gates without hitting the DB, so the payload
 * carries it. jose works in edge + node runtimes. Trust anchor is still the
 * DB row in impersonation_sessions — the cookie merely mirrors it; writes
 * always re-check the session is still open before attributing.
 */

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import type { UserRole } from './roles';

export const IMPERSONATION_COOKIE = 'vms_impersonation';
const MAX_AGE_SECONDS = 8 * 60 * 60; // 8h

export interface ImpersonationCookie {
  /** impersonation_sessions.id */
  sid: string;
  /** impersonator (real user) profile id + name */
  iid: string;
  iname: string;
  /** target (effective) profile id, role, name */
  tid: string;
  trole: UserRole;
  tname: string;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not configured');
  return new TextEncoder().encode(s);
}

export async function createImpersonationCookie(
  payload: ImpersonationCookie,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifyImpersonationCookie(
  token: string | undefined | null,
): Promise<ImpersonationCookie | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (
      typeof payload.sid !== 'string' ||
      typeof payload.iid !== 'string' ||
      typeof payload.tid !== 'string' ||
      typeof payload.trole !== 'string' ||
      typeof payload.tname !== 'string' ||
      typeof payload.iname !== 'string'
    ) {
      return null;
    }
    return {
      sid: payload.sid,
      iid: payload.iid,
      iname: payload.iname,
      tid: payload.tid,
      trole: payload.trole as UserRole,
      tname: payload.tname,
    };
  } catch {
    return null;
  }
}

/** Server-components/actions: read + verify the impersonation cookie. */
export async function readImpersonationCookie(): Promise<ImpersonationCookie | null> {
  const store = await cookies();
  return verifyImpersonationCookie(store.get(IMPERSONATION_COOKIE)?.value);
}

/** Server actions only: set the cookie (throws outside a writable context). */
export async function setImpersonationCookie(payload: ImpersonationCookie) {
  const token = await createImpersonationCookie(payload);
  (await cookies()).set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearImpersonationCookie() {
  (await cookies()).delete(IMPERSONATION_COOKIE);
}
