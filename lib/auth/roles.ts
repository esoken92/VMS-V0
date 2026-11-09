/**
 * Shared role + enum constants (mirrors the Postgres enums).
 */

export const USER_ROLES = [
  'super_admin',
  'manager',
  'admin',
  'fleet_dispatch',
  'staff',
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ITEM_TYPES = ['consumable', 'fluid', 'tool', 'tire'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const MOVEMENT_TYPES = [
  'inbound',
  'outbound',
  'adjustment',
  'scrap',
  'tool_checkout',
  'receiving',
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const STOCK_TAKE_STATUSES = ['open', 'completed'] as const;
export type StockTakeStatus = (typeof STOCK_TAKE_STATUSES)[number];

export function isUserRole(value: string): value is UserRole {
  return (USER_ROLES as readonly string[]).includes(value);
}
