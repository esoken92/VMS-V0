/**
 * lib/persona — the single source of truth for the demo persona model.
 *
 * Two personas:
 *
 *   builder  — super_admin + admin: the full technical/config surface
 *              (storerooms, monitoring admin, integrations, API keys,
 *              users, reports admin, system settings, impersonation).
 *   operator — staff + fleet_dispatch: the day-to-day warehouse surface
 *              (dashboard, inventory read, their stock movements, scan,
 *              stock takes, tool loans, zone map).
 *
 *   manager  — "builder-lite": rides in the builder persona but is
 *              excluded from integrations/API keys and user-management
 *              config (those gates use ADMIN_ROLES / SUPER_ADMIN_ONLY
 *              instead of BUILDER_ROLES).
 *
 * Everything that decides "who sees what" funnels through this file:
 *   - lib/navigation-config.ts tags each sidebar item with a role group
 *   - middleware.ts denies gated routes via allowedRolesForPath()
 *   - the "View as worker" preview cookie forces the operator experience
 *
 * This module must stay edge-safe: middleware imports it. No next/headers,
 * no DB, no node-only APIs — pure types, constants and functions only.
 */

import type { UserRole } from '@/lib/auth/roles';

export type Persona = 'builder' | 'operator';

/** super_admin + admin + manager (manager = builder-lite). */
export const BUILDER_ROLES = ['super_admin', 'admin', 'manager'] as const satisfies readonly UserRole[];

/** staff + fleet_dispatch — the day-to-day warehouse surface. */
export const OPERATOR_ROLES = ['staff', 'fleet_dispatch'] as const satisfies readonly UserRole[];

/**
 * super_admin + admin only — builder surfaces that manager (builder-lite)
 * does NOT get: integrations / API keys / user-management config.
 */
export const ADMIN_ROLES = ['super_admin', 'admin'] as const satisfies readonly UserRole[];

export const SUPER_ADMIN_ONLY = ['super_admin'] as const satisfies readonly UserRole[];

export function isUserRoleIn(role: UserRole, roles: readonly UserRole[]): boolean {
  return (roles as readonly string[]).includes(role);
}

/** Map a role to its persona. `manager` is a builder (builder-lite). */
export function personaForRole(role: UserRole | null | undefined): Persona | null {
  if (!role) return null;
  return isUserRoleIn(role, OPERATOR_ROLES) ? 'operator' : 'builder';
}

export function isOperatorRole(role: UserRole | null | undefined): boolean {
  return personaForRole(role) === 'operator';
}

export function isBuilderRole(role: UserRole | null | undefined): boolean {
  return personaForRole(role) === 'builder';
}

/**
 * Route gates: path prefix → roles allowed past it.
 * Longest matching prefix wins (same semantics the middleware used before).
 * Any authenticated user may reach dashboard paths NOT listed here
 * (dashboard home, inventory, stock-movements, stock-takes, tool-loans,
 * zone-map, scan, profile, forbidden).
 */
export const ROUTE_ACCESS: ReadonlyArray<{ prefix: string; roles: readonly UserRole[] }> = [
  // Builder surfaces — manager included.
  { prefix: '/dashboard/bin-locations', roles: BUILDER_ROLES },
  { prefix: '/dashboard/rooms', roles: BUILDER_ROLES },
  { prefix: '/dashboard/monitoring', roles: BUILDER_ROLES },
  { prefix: '/dashboard/reports', roles: BUILDER_ROLES },
  { prefix: '/dashboard/ledger', roles: BUILDER_ROLES },
  { prefix: '/dashboard/suppliers', roles: BUILDER_ROLES },
  { prefix: '/dashboard/audit-log', roles: BUILDER_ROLES },
  // Admin-only surfaces — manager (builder-lite) excluded.
  { prefix: '/dashboard/integrations', roles: ADMIN_ROLES },
  { prefix: '/dashboard/users', roles: ADMIN_ROLES },
  // Super-admin-only config.
  { prefix: '/dashboard/settings', roles: SUPER_ADMIN_ONLY },
  { prefix: '/dashboard/impersonate', roles: SUPER_ADMIN_ONLY },
];

/** Where denied requests land (must itself stay ungated to avoid loops). */
export const FORBIDDEN_PATH = '/dashboard/forbidden';

/**
 * Roles allowed to use the gated `pathname`, or null when the path is
 * open to any authenticated user.
 */
export function allowedRolesForPath(pathname: string): readonly UserRole[] | null {
  const match = ROUTE_ACCESS.filter(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + '/'),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match?.roles ?? null;
}

/** Whether `role` may pass the route gate for `pathname`. */
export function canAccessPath(role: UserRole | null | undefined, pathname: string): boolean {
  const roles = allowedRolesForPath(pathname);
  if (!roles) return true; // ungated — any authenticated user
  return !!role && isUserRoleIn(role, roles);
}

/* ------------------------------------------------------------------ */
/* "View as worker" preview                                            */
/* ------------------------------------------------------------------ */

/**
 * Signed-out-safe, downgrade-only cookie. It can never widen access —
 * middleware only honours `vms_preview=operator` when the REAL session
 * role can preview (admin/super_admin), and it only ever swaps the
 * effective role down to PREVIEW_ROLE. A forged cookie therefore does
 * nothing or reduces privileges — never elevates them.
 *
 * Not httpOnly: client components (sidebar, banner, user menu) need to
 * detect preview state via document.cookie. Server actions never consult
 * it — writes are always attributed to the real actor.
 */
export const PREVIEW_COOKIE = 'vms_preview';
export const PREVIEW_VALUE = 'operator';

/** Who may use "View as worker" (admin/super_admin — NOT manager). */
export const PREVIEW_ALLOWED_ROLES = ADMIN_ROLES;

/** The effective role the app behaves as while previewing. */
export const PREVIEW_ROLE: UserRole = 'staff';

/** Whether the real role may drive the worker preview. */
export function canPreviewAsWorker(role: UserRole | null | undefined): boolean {
  return !!role && isUserRoleIn(role, PREVIEW_ALLOWED_ROLES);
}

/**
 * Resolve the effective role for nav/route gating.
 * Preview wins over impersonation: "view as worker" is a UX-level override
 * that forces the operator experience regardless of who is being viewed.
 */
export function effectiveRoleFor(opts: {
  realRole: UserRole | null | undefined;
  impersonatedRole?: UserRole | null;
  previewCookie?: string | null;
}): UserRole | null {
  if (
    opts.previewCookie === PREVIEW_VALUE &&
    canPreviewAsWorker(opts.realRole)
  ) {
    return PREVIEW_ROLE;
  }
  return opts.impersonatedRole ?? opts.realRole ?? null;
}
