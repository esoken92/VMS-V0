/**
 * Next.js Middleware
 * Protects routes and enforces authentication/authorization
 *
 * Uses @supabase/auth-helpers-nextjs so the session cookie is resolved
 * for whatever project the env vars point at — no project-ref hardcoding.
 * Role checks mirror the sidebar visibility in lib/navigation-config.ts;
 * row-level security remains the real enforcement layer underneath.
 */

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/supabase/types';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password', '/scan'];

// Routes that require specific roles
const ROLE_BASED_ROUTES: Record<string, string[]> = {
  '/dashboard/reports': ['super_admin', 'admin'],
  '/dashboard/users': ['super_admin', 'admin'],
  '/dashboard/suppliers': ['super_admin', 'admin'],
  '/dashboard/audit-log': ['super_admin', 'admin'],
  '/dashboard/settings': ['super_admin'],
  '/dashboard/impersonate': ['super_admin'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  const supabase = createMiddlewareClient<Database>({ req: request, res: response });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // Unauthenticated: only public routes are reachable
  if (!session) {
    if (isPublicRoute) {
      return response;
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
    // The placeholder Database type lacks Relationships metadata, so the
    // typed query resolves to never — take the untyped response instead.
    const { data: profile } = (await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()) as unknown as {
      data: { role: Database['public']['Enums']['user_role'] } | null;
    };

    if (!profile || !ROLE_BASED_ROUTES[gatedRoute].includes(profile.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icons, manifest.json, sw.js and workbox files (PWA assets)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-).*)',
  ],
};
