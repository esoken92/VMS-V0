/**
 * lib/scan/types — serializable DTOs shared between the scan server
 * actions, the /api/scan route handler, and the scan-first UI.
 */

import type { ScanEntityType, ScanInputType } from '@/drizzle/scan-schema';
import type { BinLocationDTO, ProductDTO, StockTakeDTO } from '@/lib/types';

export type { ScanEntityType, ScanInputType };

/** Actions the UI may offer for a resolved entity (role-gated server-side). */
export type ScanAction =
  | 'view'
  | 'receive'
  | 'issue'
  | 'set_location'
  | 'join_take'
  | 'tool_toggle'
  | 'create_product';

export interface ScanEntityRef {
  type: ScanEntityType;
  id: string;
  /** Short human label: SKU, zone-bin, take id… */
  label: string;
  /** Secondary line: product name, bin description, take status… */
  detail: string | null;
}

export interface ActiveLoanInfo {
  loan_id: string;
  worker_profile_id: string;
  worker_name: string | null;
  checked_out_at: string | null;
}

export interface ScanResolutionDTO {
  ok: boolean;
  /** Populated when ok=false — safe to show the operator. */
  error: string | null;
  /** Normalized (sanitized) code as scanned — display only. */
  code: string;
  input_type: ScanInputType;
  /** True when input_type='manual' — UI must surface "manual entry logged". */
  manual_logged: boolean;
  scan_event_id: string | null;
  entity: ScanEntityRef | null;
  allowed_actions: ScanAction[];
  /** Anomaly note (e.g. impossible_velocity) — surfaced as a warning. */
  flag_reason: string | null;

  product?: ProductDTO | null;
  product_bin?: BinLocationDTO | null;
  active_loan?: ActiveLoanInfo | null;
  bin_location?: BinLocationDTO | null;
  stock_take?: StockTakeDTO | null;
  /** Unknown-code path: suggested SKU for the create-product prefill. */
  suggested_sku?: string | null;
}

/** Result of a scan-driven write (receive/issue/toggle/join). */
export interface ScanWriteResultDTO {
  message: string;
  scan_event_id: string | null;
  /** Refresh payload so the status panel stays current. */
  product?: ProductDTO | null;
  active_loan?: ActiveLoanInfo | null;
  stock_take?: StockTakeDTO | null;
}
