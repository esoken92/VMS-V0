/**
 * Next.js Middleware — Auth.js (NextAuth v5) JWT session.
 * Protects routes and enforces authentication/authorization.
 *
 * Role checks mirror the sidebar visibility in lib/navigation-config.ts;
 * server actions re-check the permission matrix on every write — middleware
 * is navigation gating, not the enforcement layer.
 *
 * Impersonation: the signed `vms_impersonation` cookie carries the effective
 * (target) role so a super_admin viewing as staff sees staff-level routes.
 * The cookie only downgrades; the actor's real role comes from the JWT.
 * Server-side helpers validate the impersonation_sessions DB row before
 * attributing writes, so a forged/expired-cookie scenario can't write.
 */

import NextAuth from 'next-auth';
import authConfig from '@/auth.config';
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import type { UserRole } from '@/lib/auth/roles';

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/scan',
];

// Routes that require specific roles (same gates as the old middleware)
const ROLE_BASED_ROUTES: Record<string, UserRole[]> = {
  '/dashboard/reports': ['super_admin', 'admin'],
  '/dashboard/users': ['super_admin', 'admin'],
  '/dashboard/suppliers': ['super_admin', 'admin'],
  '/dashboard/audit-log': ['super_admin', 'admin'],
  '/dashboard/settings': ['super_admin'],
  '/dashboard/impersonate': ['super_admin'],
};

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
export default auth(async function middleware(request) {
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

  // Role-based route checks (longest matching prefix wins)
  const gatedRoute = Object.keys(ROLE_BASED_ROUTES)
    .filter((route) => pathname === route || pathname.startsWith(route + '/'))
    .sort((a, b) => b.length - a.length)[0];

  if (gatedRoute) {
    const effectiveRole = (await impersonatedRole(request)) ?? session.user.role;
    if (!effectiveRole || !ROLE_BASED_ROUTES[gatedRoute].includes(effectiveRole)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
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
     * - llms.txt (public agent-discovery manifest, like robots.txt)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icons|llms.txt|manifest.json|sw.js|workbox-).*)',
  ],
};
