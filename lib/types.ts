/**
 * lib/types — serializable DTOs shared between server actions and client
 * components. Field names intentionally use snake_case to match the old
 * supabase-js row shapes so UI churn stays minimal. Postgres `numeric`
 * columns arrive as strings; actions convert them to `number` here.
 */

import type { UserRole } from '@/lib/auth/roles';

export type { UserRole };
export { USER_ROLES } from '@/lib/auth/roles';
export type { ItemType, MovementType, StockTakeStatus } from '@/lib/auth/roles';
import type { DbMovementType } from '@/lib/auth/roles';
export type { DbMovementType };

/** profiles row as consumed by the client (includes email from auth.users). */
export interface ProfileDTO {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  alert_low_stock: boolean;
  alert_overdue_tools: boolean;
  created_at: string | null;
}

/** What the session provider exposes as `user` (actor identity). */
export interface SessionUserDTO {
  id: string;
  email: string | null;
}

export interface ImpersonationState {
  active: boolean;
  session_id?: string;
  target_profile?: ProfileDTO;
  impersonator?: { id: string; full_name: string };
}

export interface SessionProfileResponse {
  user: SessionUserDTO;
  profile: ProfileDTO;
  impersonation: ImpersonationState | null;
}

export interface BinLocationDTO {
  id: string;
  zone: string;
  bin_location: string;
  max_weight_kg: number;
  description: string | null;
}

export interface SupplierDTO {
  id: string;
  name: string;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
}

export interface ProductDTO {
  id: string;
  sku: string;
  name: string;
  item_type: 'consumable' | 'fluid' | 'tool' | 'tire';
  current_stock: number;
  min_threshold: number;
  average_cost: number;
  unit_of_measure: string;
  issuing_unit: string;
  bin_location_id: string | null;
  supplier_id: string | null;
  weight_per_unit_kg: number;
  carries_core_charge: boolean;
  core_charge_amount: number;
  last_movement_date: string | null;
}

export interface StockMovementDTO {
  id: string;
  product_id: string;
  product_sku: string | null;
  product_name: string | null;
  product_unit: string | null;
  user_id: string;
  user_name: string | null;
  type: DbMovementType;
  quantity: number;
  reason: string | null;
  scrap_image_url: string | null;
  created_at: string | null;
}

export interface ToolLoanDTO {
  id: string;
  tool_product_id: string;
  product_sku: string | null;
  product_name: string | null;
  worker_profile_id: string;
  worker_name: string | null;
  checked_out_by_user_id: string;
  checked_out_by_name: string | null;
  checked_out_at: string | null;
  expected_return_at: string | null;
  returned_at: string | null;
  condition_on_checkout: string | null;
  condition_on_return: string | null;
  notes: string | null;
}

export interface ProfileOptionDTO {
  id: string;
  full_name: string;
}

/** Super-admin impersonation picker: name + login email + role. */
export interface ImpersonatableUserDTO {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
}

export interface StockTakeDTO {
  id: string;
  started_by: string;
  started_by_name: string | null;
  status: 'open' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  items_counted: number;
  items_total: number;
}

export interface StockTakeItemDTO {
  id: string;
  stock_take_id: string;
  product_id: string;
  system_qty: number;
  physical_qty: number | null;
  variance: number | null;
  counted_by: string | null;
  counted_at: string | null;
}

export interface UserListItemDTO {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  has_password: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
}

export interface SystemSettingDTO {
  key: string;
  value: string;
  category: string;
  description: string | null;
  updated_at: string | null;
}

export interface ActivityLogDTO {
  id: string;
  user_id: string | null;
  user_name: string | null;
  impersonated_by_name: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
}

export interface ReportProductDTO {
  id: string;
  sku: string;
  name: string;
  item_type: string;
  current_stock: number;
  min_threshold: number;
  average_cost: number;
  unit_of_measure: string;
}

export interface ReportMovementDTO {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  created_at: string | null;
}

export interface ReportDataDTO {
  products: ReportProductDTO[];
  movements: ReportMovementDTO[];
}

/**
 * One row of the per-product movement ledger (Kardex). `quantity` is the
 * signed movement (positive adds stock); `running_balance` is the closing
 * balance after this row — opening balance + cumulative movements,
 * computed server-side.
 */
export interface KardexEntryDTO {
  id: string;
  product_id: string;
  product_sku: string | null;
  product_name: string | null;
  product_unit: string | null;
  user_id: string;
  user_name: string | null;
  type: DbMovementType;
  quantity: number;
  running_balance: number;
  reason: string | null;
  created_at: string | null;
}

/**
 * Per-product reconciliation — the math shared by the Kardex page, the
 * /api/v1/reconciliation endpoint and scripts/verify-ledger.ts:
 *
 *   expected_closing = opening + Σ stock_movements.quantity
 *   drift            = products.current_stock − expected_closing
 *
 * `opening` is the signed sum of movements before the queried window
 * (0 when `from` is unset). drift != 0 means current stock is not fully
 * explained by the ledger — e.g. seed data or direct edits that bypassed
 * stock_movements.
 */
export interface ReconciliationDTO {
  product_id: string;
  sku: string;
  name: string;
  unit_of_measure: string;
  opening: number;
  inbound: number;
  outbound: number;
  scrap: number;
  adjustment: number;
  receiving: number;
  tool_checkout: number;
  /** kit_consume + kit_produce combined (transfer legs net to zero). */
  kit: number;
  movements_total: number;
  expected_closing: number;
  actual_stock: number;
  drift: number;
  reconciles: boolean;
}

export interface KardexDTO {
  /** Balance carried into the window (0 when `from` is unset). */
  opening_balance: number;
  /** Ledger rows, chronological; running_balance is per product. */
  entries: KardexEntryDTO[];
  /** True when more rows matched than the returned cap — narrow the filter. */
  entries_truncated: boolean;
  /**
   * Per-product reconciliation over the FULL movement history (same math
   * as GET /api/v1/reconciliation) — filtered to product_id when given.
   */
  summaries: ReconciliationDTO[];
}

// ---- Transfers + kits (014) ----

export type TransferStatus = 'draft' | 'dispatched' | 'received' | 'cancelled';

/** One product's quantity at a bin — the product_stock projection row. */
export interface BinStockDTO {
  product_id: string;
  product_sku: string | null;
  product_name: string | null;
  product_unit: string | null;
  quantity: number;
}

export interface TransferDTO {
  id: string;
  transfer_number: string;
  status: TransferStatus;
  from_bin_location_id: string;
  from_bin_label: string | null;
  to_bin_location_id: string;
  to_bin_label: string | null;
  notes: string | null;
  created_by: string;
  created_by_name: string | null;
  dispatched_by: string | null;
  dispatched_by_name: string | null;
  dispatched_at: string | null;
  received_by: string | null;
  received_by_name: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  item_count: number;
  created_at: string | null;
}

export interface TransferItemDTO {
  id: string;
  transfer_id: string;
  product_id: string;
  product_sku: string | null;
  product_name: string | null;
  product_unit: string | null;
  quantity: number;
  dispatched_quantity: number;
  received_quantity: number;
}

/** One BOM row — component + required qty per kit unit. */
export interface KitComponentDTO {
  component_product_id: string;
  product_sku: string | null;
  product_name: string | null;
  product_unit: string | null;
  quantity: number;
  component_stock: number;
}

/** A kit product + how many units current component stock can build. */
export interface KitDTO {
  product_id: string;
  product_sku: string | null;
  product_name: string | null;
  product_unit: string | null;
  current_stock: number;
  component_count: number;
  buildable: number;
}

export interface ReportDatasetMetaDTO {
  id: string;
  label: string;
  description: string;
  columns: { key: string; label: string }[];
  filters: {
    key: string;
    label: string;
    type: 'number' | 'select';
    options?: { value: string; label: string }[];
    default?: string;
    placeholder?: string;
  }[];
}

export interface CustomReportResultDTO {
  dataset: string;
  label: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
  row_count: number;
  capped: boolean;
  generated_at: string;
}
