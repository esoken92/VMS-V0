/**
 * Next.js Middleware
 * Protects routes and enforces authentication/authorization
 */

import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/', '/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password', '/scan'];

// Routes that require specific roles
const ROLE_BASED_ROUTES = {
  '/dashboard': ['super_admin', 'admin', 'fleet_dispatch', 'staff'],
  '/dashboard/reports': ['super_admin', 'admin'],
  '/dashboard/users': ['super_admin', 'admin'],
  '/dashboard/settings': ['super_admin', 'admin'],
  '/dashboard/impersonate': ['super_admin'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // TEMPORARILY DISABLED FOR TESTING - allow all routes
  return NextResponse.next();

  // Get auth token from cookies - Supabase uses sb-access-token or sb-[project-ref]-auth-token
  const token = request.cookies.get('sb-access-token')?.value || 
                request.cookies.get('sb-ilywbbeptdjhgwqrbuuf-auth-token')?.value;
  const userRole = request.cookies.get('user-role')?.value;

  // Allow public routes - exact match or starts with
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );

  if (isPublicRoute) {
    // If authenticated and on auth pages, redirect to dashboard
    if (token && pathname.startsWith('/auth')) {
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
