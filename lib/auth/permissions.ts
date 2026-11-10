/**
 * Application-layer authorization — replaces Supabase RLS.
 *
 * Every server action calls `requireRole`/`can` BEFORE touching the DB.
 * The matrix below ports the intent of the old RLS policies
 * (001_initial_schema.sql + 006_add_manager_role.sql):
 *
 *   super_admin    — everything
 *   admin          — everything except super_admin-only areas
 *                    (system_settings, impersonation, user delete,
 *                    granting super_admin)
 *   manager        — read/write products, suppliers, stock takes, tool loans,
 *                    movements; NO bin-location writes, NO deletes, NO
 *                    settings/users/impersonation
 *   fleet_dispatch — read catalog + loans; create outbound/tool_checkout
 *                    movements; create loans (incl. for others); return own
 *                    loans
 *   staff          — read catalog; own loans/movements only; inbound/
 *                    adjustment/receiving movements; stock-take write;
 *                    self-checkout tools; return own loans
 *
 * `:own` scopes mean "rows the user owns" — enforced in the action's query
 * (e.g. staff reads only stock_movements.user_id = self).
 */

import type { MovementType, UserRole } from './roles';

export type Permission =
  | 'products:read'
  | 'products:write'
  | 'products:delete'
  | 'suppliers:read'
  | 'suppliers:write'
  | 'suppliers:delete'
  | 'bin_locations:read'
  | 'bin_locations:write'
  | 'unit_conversions:read'
  | 'unit_conversions:write'
  | 'profiles:read:all'
  | 'profiles:write:any'
  | 'tool_loans:read:all'
  | 'tool_loans:create'
  | 'tool_loans:create:for_other'
  | 'tool_loans:return:any'
  | 'receiving:read'
  | 'receiving:write'
  | 'stock_movements:read:all'
  | 'stock_takes:read'
  | 'stock_takes:write'
  | 'activity_logs:read'
  | 'system_settings:read'
  | 'system_settings:write'
  | 'users:read'
  | 'users:create'
  | 'users:update'
  | 'users:delete'
  | 'users:grant_super_admin'
  | 'impersonation:use'
  | 'reports:read'
  | 'transfers:read'
  | 'transfers:create'
  | 'transfers:dispatch'
  | 'transfers:receive'
  | 'transfers:cancel'
  | 'kits:read'
  | 'kits:write'
  | 'kits:assemble';

export const ALL_MOVEMENT_PERMS = [
  'stock_movements:create:inbound',
  'stock_movements:create:outbound',
  'stock_movements:create:adjustment',
  'stock_movements:create:scrap',
  'stock_movements:create:tool_checkout',
  'stock_movements:create:receiving',
] as const;

export type MovementCreatePermission = (typeof ALL_MOVEMENT_PERMS)[number];

const BASE_READ: Permission[] = [
  'products:read',
  'suppliers:read',
  'bin_locations:read',
  'unit_conversions:read',
  'stock_takes:read',
  'activity_logs:read',
  'receiving:read',
  'transfers:read',
  'kits:read',
];

const ADMIN_PERMS: Permission[] = [
  ...BASE_READ,
  'products:write',
  'products:delete',
  'suppliers:write',
  'suppliers:delete',
  'bin_locations:write',
  'unit_conversions:write',
  'profiles:read:all',
  'profiles:write:any',
  'tool_loans:read:all',
  'tool_loans:create',
  'tool_loans:create:for_other',
  'tool_loans:return:any',
  'receiving:write',
  'stock_movements:read:all',
  'stock_takes:write',
  'users:read',
  'users:create',
  'users:update',
  'reports:read',
  'transfers:create',
  'transfers:dispatch',
  'transfers:receive',
  'transfers:cancel',
  'kits:write',
  'kits:assemble',
];

const PERMISSION_MATRIX: Record<UserRole, Permission[]> = {
  super_admin: [
    ...ADMIN_PERMS,
    'system_settings:read',
    'system_settings:write',
    'users:delete',
    'users:grant_super_admin',
    'impersonation:use',
  ],
  admin: ADMIN_PERMS,
  manager: [
    ...BASE_READ,
    'products:write', // add/edit but NOT delete (006)
    'suppliers:write',
    'tool_loans:read:all',
    'tool_loans:create',
    'tool_loans:create:for_other',
    'tool_loans:return:any',
    'receiving:write',
    'stock_movements:read:all',
    'stock_takes:write',
    'transfers:create',
    'transfers:dispatch',
    'transfers:receive',
    'transfers:cancel',
    'kits:write',
    'kits:assemble',
  ],
  fleet_dispatch: [
    ...BASE_READ,
    'tool_loans:read:all',
    'tool_loans:create',
    'tool_loans:create:for_other',
  ],
  staff: [
    ...BASE_READ,
    'tool_loans:create', // self-checkout only (no :for_other)
    'receiving:write',
    'stock_takes:write',
    'transfers:create', // requestor — a manager/admin dispatches it
  ],
};

/** Movement types each role may insert (ports the old WITH CHECK rules). */
const MOVEMENT_TYPE_MATRIX: Record<UserRole, MovementType[]> = {
  super_admin: [...ALL_MOVEMENT_TYPES()],
  admin: [...ALL_MOVEMENT_TYPES()],
  manager: [...ALL_MOVEMENT_TYPES()],
  fleet_dispatch: ['outbound', 'tool_checkout'],
  staff: ['inbound', 'adjustment', 'receiving'],
};

function ALL_MOVEMENT_TYPES(): MovementType[] {
  return ['inbound', 'outbound', 'adjustment', 'scrap', 'tool_checkout', 'receiving'];
}

/** Check whether `role` holds `permission`. */
export function can(role: UserRole, permission: Permission): boolean {
  return PERMISSION_MATRIX[role]?.includes(permission) ?? false;
}

/** Check whether `role` may create a stock movement of `type`. */
export function canCreateMovement(role: UserRole, type: MovementType): boolean {
  return MOVEMENT_TYPE_MATRIX[role]?.includes(type) ?? false;
}

export { PERMISSION_MATRIX, MOVEMENT_TYPE_MATRIX };
