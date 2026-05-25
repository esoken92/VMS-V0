/**
 * Next.js Middleware
 * Protects routes and enforces authentication/authorization
 */

import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password'];

// Routes that require specific roles
const ROLE_BASED_ROUTES = {
  '/dashboard': ['super_admin', 'admin', 'dispatch', 'picker'],
  '/reports': ['super_admin', 'admin'],
  '/settings': ['super_admin', 'admin'],
  '/impersonate': ['super_admin'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get auth token from cookies
  const token = request.cookies.get('sb-access-token')?.value;
  const userRole = request.cookies.get('user-role')?.value;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    // If authenticated, redirect from auth pages to dashboard
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Check authentication for protected routes
  if (!token) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // Check role-based access
  for (const [route, allowedRoles] of Object.entries(ROLE_BASED_ROUTES)) {
    if (pathname.startsWith(route) && !allowedRoles.includes(userRole || '')) {
      // Redirect to dashboard if unauthorized
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
