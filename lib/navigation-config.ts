/**
 * Navigation Configuration
 * Define all dashboard navigation items
 *
 * Each item declares which roles may see it via `roles` — the persona
 * groups come from lib/persona.ts so role lists are defined in ONE place.
 * `roles` undefined → every authenticated user (operator AND builder).
 * Middleware enforces the same gates for direct URL hits
 * (lib/persona.ts ROUTE_ACCESS), so hiding here is only UX.
 */

import type { UserRole } from '@/lib/auth/roles';
import {
  ADMIN_ROLES,
  BUILDER_ROLES,
  SUPER_ADMIN_ONLY,
  isUserRoleIn,
} from '@/lib/persona';

export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  description?: string;
  /** Roles that see this item; undefined = all authenticated users. */
  roles?: readonly UserRole[];
}

export const navigationConfig: NavigationItem[] = [
  /* --- Shared: operator + builder --- */
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
    description: 'Overview and quick stats',
  },
  {
    label: 'Inventory',
    href: '/dashboard/inventory',
    icon: '📦',
    description: 'Product management',
  },
  {
    label: 'Stock Movements',
    href: '/dashboard/stock-movements',
    icon: '🔄',
    description: 'Inbound, outbound, scrap',
  },
  {
    label: 'Ledger',
    href: '/dashboard/ledger',
    icon: '📒',
    description: 'Per-product movement ledger (Kardex)',
    roles: BUILDER_ROLES, // getKardex requires stock_movements:read:all (manager+)
  },
  {
    label: 'Stock Takes',
    href: '/dashboard/stock-takes',
    icon: '📋',
    description: 'Inventory counts',
  },
  {
    label: 'Tool Loans',
    href: '/dashboard/tool-loans',
    icon: '🔧',
    description: 'Tool checkout/return',
  },
  {
    label: 'Zone Map',
    href: '/dashboard/zone-map',
    icon: '�️',
    description: 'Visual warehouse layout',
  },
  {
    label: 'Scan',
    href: '/dashboard/scan',
    icon: '�',
    description: 'Scan-first receive, issue & lookup',
  },

  /* --- Builder surfaces (manager = builder-lite, included) --- */
  {
    label: 'Bin Locations',
    href: '/dashboard/bin-locations',
    icon: '�',
    description: 'Warehouse locations',
    roles: BUILDER_ROLES,
  },
  {
    label: 'Storerooms',
    href: '/dashboard/rooms',
    icon: '🏠',
    description: 'Rooms, zones & access rules',
    roles: BUILDER_ROLES,
  },
  {
    label: 'Monitoring',
    href: '/dashboard/monitoring',
    icon: '🌡️',
    description: 'Sensors, climate & alerts',
    roles: BUILDER_ROLES,
  },
  {
    label: 'Reports',
    href: '/dashboard/reports',
    icon: '�',
    description: 'Analytics and insights',
    roles: BUILDER_ROLES,
  },
  {
    label: 'Suppliers',
    href: '/dashboard/suppliers',
    icon: '�',
    description: 'Supplier management',
    roles: BUILDER_ROLES,
  },
  {
    label: 'Audit Log',
    href: '/dashboard/audit-log',
    icon: '�',
    description: 'Activity history',
    roles: BUILDER_ROLES,
  },

  /* --- Admin-only: manager excluded (integrations / user mgmt) --- */
  {
    label: 'Integrations',
    href: '/dashboard/integrations',
    icon: '�',
    description: 'MCP, API keys & docs',
    roles: ADMIN_ROLES,
  },
  {
    label: 'Users',
    href: '/dashboard/users',
    icon: '�',
    description: 'User management',
    roles: ADMIN_ROLES,
  },

  /* --- Super-admin-only config --- */
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: '⚙️',
    description: 'System configuration',
    roles: SUPER_ADMIN_ONLY,
  },
  {
    label: 'Impersonate',
    href: '/dashboard/impersonate',
    icon: '🎭',
    description: 'View as user',
    roles: SUPER_ADMIN_ONLY,
  },
];

/**
 * Nav items visible to `role` — pass the EFFECTIVE role
 * (impersonation- and worker-preview-aware) so previews render the
 * operator sidebar.
 */
export function visibleNavItems(role: UserRole | null | undefined): NavigationItem[] {
  return navigationConfig.filter(
    (item) => !item.roles || (!!role && isUserRoleIn(role, item.roles)),
  );
}

export const userMenuItems: NavigationItem[] = [
  {
    label: 'My Profile',
    href: '/dashboard/profile',
    icon: '👤',
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: '⚙️',
  },
  {
    label: 'Help',
    href: '#',
    icon: '❓',
  },
];
