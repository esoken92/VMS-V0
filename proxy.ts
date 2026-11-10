/**
 * Next.js Proxy — Auth.js (NextAuth v5) JWT session.
 * Protects routes and enforces authentication/authorization.
 *
 * Role/persona gates come from ONE place: lib/persona.ts (ROUTE_ACCESS),
 * which mirrors the per-item visibility in lib/navigation-config.ts.
 * Denied requests redirect to /dashboard/forbidden (a clean 403 page —
 * never a silent loop back to /dashboard). Server actions re-check the
 * permission matrix on every write — proxy is navigation gating,
 * not the enforcement layer.
 *
 * Impersonation: the signed `vms_impersonation` cookie carries the effective
 * (target) role so a super_admin viewing as staff sees staff-level routes.
 * The cookie only downgrades; the actor's real role comes from the JWT.
 * Server-side helpers validate the impersonation_sessions DB row before
 * attributing writes, so a forged/expired-cookie scenario can't write.
 *
 * Worker preview: `vms_preview=operator` (set only via the enterWorkerPreview
 * server action, admin/super_admin only) forces the operator experience —
 * nav + route gates behave as `staff` — without touching the session.
 */

import NextAuth from 'next-auth';
import authConfig from '@/auth.config';
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import type { UserRole } from '@/lib/auth/roles';
import {
  FORBIDDEN_PATH,
  PREVIEW_COOKIE,
  allowedRolesForPath,
  canAccessPath,
  effectiveRoleFor,
} from '@/lib/persona';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/scan',
  // crawler + social-card assets must not bounce to the login page
  '/robots.txt',
  '/sitemap.xml',
  '/icon.svg',
  '/apple-icon.png',
  '/opengraph-image.png',
  '/humans.txt',
  '/.well-known/security.txt',
  // Google Search Console ownership file — only verifies this deployment's
  // domain; harmless for anyone who clones the template
  '/google6ddf052c23bde653.html',
];

const IMPERSONATION_COOKIE = 'vms_impersonation';

async function impersonatedRole(request: NextRequest): Promise<UserRole | null> {
  const token = request.cookies.get(IMPERSONATION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return typeof payload.trole === 'string' ? (payload.trole as UserRole) : null;
  } catch {
    return null;
  }
}

const { auth } = NextAuth(authConfig);

// The auth() wrapper augments the request with `.auth` — let TS infer it.
export default auth(async function proxy(request) {
  const { pathname } = request.nextUrl;
  const session = request.auth;

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/'),
  );

  // Unauthenticated: only public routes are reachable
  if (!session?.user) {
    if (isPublicRoute) {
      return NextResponse.next();
    }
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated users on auth pages go straight to the dashboard
  if (pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Persona route gates (longest matching prefix wins — lib/persona.ts).
  if (allowedRolesForPath(pathname)) {
    const effectiveRole = effectiveRoleFor({
      realRole: session.user.role,
      impersonatedRole: await impersonatedRole(request),
      previewCookie: request.cookies.get(PREVIEW_COOKIE)?.value ?? null,
    });
    if (!canAccessPath(effectiveRole, pathname)) {
      // Clean 403 page — no silent redirect loop. The denied path is
      // preserved in the query so the page can show context.
      const forbiddenUrl = new URL(FORBIDDEN_PATH, request.url);
      forbiddenUrl.searchParams.set('denied', pathname);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icons, manifest.json, sw.js and workbox files (PWA assets)
     * - screenshots (public product captures served on the landing page)
     * - llms.txt (public agent-discovery manifest, like robots.txt)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icons|llms.txt|manifest.json|screenshots|docs|sw.js|workbox-).*)',
  ],
};
