/**
 * lib/storerooms/types — serializable DTOs shared between server actions,
 * API routes and client components. snake_case to match the rest of
 * lib/types.ts. Safe to import from client components (no server deps).
 */

import type {
  RoomType,
  RoomAccessLevel,
  SensorMetric,
  AlertSeverity,
  AlertState,
  AlertThresholdOp,
} from './room-types';

export type {
  RoomType,
  RoomAccessLevel,
  SensorMetric,
  AlertSeverity,
  AlertState,
  AlertThresholdOp,
};

/** Per-room feature flags — stored in storerooms.feature_toggles (jsonb). */
export type FeatureToggles = Record<string, boolean>;

export interface RoomDTO {
  id: string;
  name: string;
  type: RoomType;
  parent_id: string | null;
  parent_name: string | null;
  description: string | null;
  temp_min: number | null;
  temp_max: number | null;
  capacity_units: number | null;
  access_level: RoomAccessLevel;
  allowed_roles: string[];
  item_allowlist: string[];
  feature_toggles: FeatureToggles;
  quarantine: boolean;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

/** listRooms() — room plus list-view rollups. */
export interface RoomListItemDTO extends RoomDTO {
  child_count: number;
  bin_count: number;
  product_count: number;
  /** Total current_stock units across products located in the room. */
  stock_units: number;
  latest_temp: number | null;
  latest_temp_at: string | null;
  /** Derived from latest_temp vs temp_min/temp_max; 'unknown' when no data. */
  temp_status: 'ok' | 'low' | 'high' | 'unknown';
  open_alert_count: number;
}

export interface RoomOptionDTO {
  id: string;
  name: string;
  type: RoomType;
}

/** Product located in a room (resolved via bin_locations.room_id). */
export interface RoomContentItemDTO {
  product_id: string;
  sku: string;
  name: string;
  item_type: string;
  current_stock: number;
  unit_of_measure: string;
  bin_label: string | null; // "zone-bin_location"
}

export interface SensorReadingDTO {
  id: string;
  room_id: string;
  metric: SensorMetric;
  value: number;
  unit: string;
  device_id: string;
  recorded_at: string;
  ingested_at: string;
}

export interface AlertRuleDTO {
  id: string;
  room_id: string;
  room_name: string | null;
  metric: SensorMetric;
  op: AlertThresholdOp;
  threshold: number;
  dwell_minutes: number;
  severity: AlertSeverity;
  notify_roles: string[];
  active: boolean;
  created_at: string | null;
}

export interface AlertDTO {
  id: string;
  rule_id: string | null;
  room_id: string;
  room_name: string | null;
  metric: SensorMetric;
  value: number;
  state: AlertState;
  opened_at: string;
  acked_by: string | null;
  acked_by_name: string | null;
  acked_at: string | null;
  resolved_at: string | null;
}

/** Monitoring dashboard: one card per room. */
export interface RoomStatusDTO {
  room_id: string;
  room_name: string;
  type: RoomType;
  temp_min: number | null;
  temp_max: number | null;
  latest_temp: number | null;
  latest_humidity: number | null;
  last_reading_at: string | null;
  minutes_since_reading: number | null;
  temp_status: 'ok' | 'low' | 'high' | 'unknown';
  open_alert_count: number;
}

/** Result returned by the ingest/simulate paths. */
export interface IngestResultDTO {
  inserted: number;
  duplicates: number;
  alerts_opened: number;
}
