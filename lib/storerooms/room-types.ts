/**
 * lib/storerooms/room-types — room/sensor/alert enum constants (mirror the
 * Postgres enums from drizzle/0003_storerooms.sql), the per-room feature
 * catalog, and getRoomTypeDefaults() — the "seed" presets per room type:
 * typical temperature ranges, access level and feature-toggle presets.
 *
 * Pure constants — safe to import from client components.
 */

export const ROOM_TYPES = [
  'general',
  'cold',
  'frozen',
  'dry',
  'it',
  'vehicle',
  'secure',
  'hazmat',
  'quarantine',
  'staging',
  'dock',
  'returns',
  'destruction',
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOM_ACCESS_LEVELS = [
  'open',
  'restricted',
  'secure',
  'locked',
] as const;
export type RoomAccessLevel = (typeof ROOM_ACCESS_LEVELS)[number];

export const SENSOR_METRICS = [
  'temperature',
  'humidity',
  'door',
  'vibration',
  'motion',
  'gas',
] as const;
export type SensorMetric = (typeof SENSOR_METRICS)[number];

export const ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATES = ['active', 'acknowledged', 'resolved'] as const;
export type AlertState = (typeof ALERT_STATES)[number];

export const ALERT_THRESHOLD_OPS = ['above', 'below'] as const;
export type AlertThresholdOp = (typeof ALERT_THRESHOLD_OPS)[number];

export function isRoomType(value: string): value is RoomType {
  return (ROOM_TYPES as readonly string[]).includes(value);
}

/** Default display units per metric (devices may override at ingest). */
export const METRIC_DEFAULT_UNITS: Record<SensorMetric, string> = {
  temperature: '°C',
  humidity: '%RH',
  door: 'state',
  vibration: 'g',
  motion: 'events',
  gas: 'ppm',
};

export const METRIC_LABELS: Record<SensorMetric, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  door: 'Door',
  vibration: 'Vibration',
  motion: 'Motion',
  gas: 'Gas',
};

// ============================================================================
// FEATURE TOGGLES — the per-room feature catalog. Keys are stable strings
// stored in storerooms.feature_toggles; labels power the toggle editor.
// ============================================================================

export interface RoomFeatureDef {
  key: string;
  label: string;
  description: string;
}

export const ROOM_FEATURES: RoomFeatureDef[] = [
  {
    key: 'environmental_monitoring',
    label: 'Environmental monitoring',
    description: 'Temperature & humidity sensors, climate charts',
  },
  {
    key: 'door_monitoring',
    label: 'Door monitoring',
    description: 'Door open/close events and door-ajar alerting',
  },
  {
    key: 'motion_detection',
    label: 'Motion detection',
    description: 'Motion/occupancy events from room sensors',
  },
  {
    key: 'vibration_monitoring',
    label: 'Vibration monitoring',
    description: 'Vibration/tamper sensors on walls and racks',
  },
  {
    key: 'threshold_alerts',
    label: 'Threshold alerts',
    description: 'Evaluate alert rules on incoming readings',
  },
  {
    key: 'occupancy_tracking',
    label: 'Occupancy tracking',
    description: 'Track stored units vs room capacity',
  },
  {
    key: 'access_control',
    label: 'Access control',
    description: 'Enforce access_level + allowed_roles on entry',
  },
  {
    key: 'quarantine_workflow',
    label: 'Quarantine workflow',
    description: 'Hold-for-inspection handling for quarantined stock',
  },
  {
    key: 'destruction_log',
    label: 'Destruction log',
    description: 'Chain-of-custody logging for destruction rooms',
  },
];

export const ROOM_FEATURE_KEYS = ROOM_FEATURES.map((f) => f.key);

export function isRoomFeatureKey(key: string): boolean {
  return ROOM_FEATURE_KEYS.includes(key);
}

// ============================================================================
// ROOM TYPE DEFAULTS — presets applied when creating a room of a given type.
// temp_min/temp_max null = unmonitored.
// ============================================================================

export interface RoomTypeDefaults {
  label: string;
  temp_min: number | null;
  temp_max: number | null;
  access_level: RoomAccessLevel;
  quarantine: boolean;
  feature_toggles: Record<string, boolean>;
}

const BASE_TOGGLES: Record<string, boolean> = {
  environmental_monitoring: false,
  door_monitoring: false,
  motion_detection: false,
  vibration_monitoring: false,
  threshold_alerts: false,
  occupancy_tracking: true,
  access_control: false,
  quarantine_workflow: false,
  destruction_log: false,
};

const ROOM_TYPE_DEFAULTS: Record<RoomType, RoomTypeDefaults> = {
  general: {
    label: 'General storage',
    temp_min: null,
    temp_max: null,
    access_level: 'open',
    quarantine: false,
    feature_toggles: { ...BASE_TOGGLES },
  },
  cold: {
    label: 'Cold room',
    temp_min: 2,
    temp_max: 8,
    access_level: 'open',
    quarantine: false,
    feature_toggles: {
      ...BASE_TOGGLES,
      environmental_monitoring: true,
      door_monitoring: true,
      threshold_alerts: true,
    },
  },
  frozen: {
    label: 'Freezer',
    temp_min: -25,
    temp_max: -15,
    access_level: 'restricted',
    quarantine: false,
    feature_toggles: {
      ...BASE_TOGGLES,
      environmental_monitoring: true,
      door_monitoring: true,
      threshold_alerts: true,
    },
  },
  dry: {
    label: 'Dry store',
    temp_min: 15,
    temp_max: 25,
    access_level: 'open',
    quarantine: false,
    feature_toggles: {
      ...BASE_TOGGLES,
      environmental_monitoring: true,
      threshold_alerts: true,
    },
  },
  it: {
    label: 'IT / server room',
    temp_min: 18,
    temp_max: 27,
    access_level: 'secure',
    quarantine: false,
    feature_toggles: {
      ...BASE_TOGGLES,
      environmental_monitoring: true,
      door_monitoring: true,
      motion_detection: true,
      threshold_alerts: true,
      access_control: true,
    },
  },
  vehicle: {
    label: 'Vehicle / mobile unit',
    temp_min: null,
    temp_max: null,
    access_level: 'restricted',
    quarantine: false,
    feature_toggles: { ...BASE_TOGGLES, occupancy_tracking: true },
  },
  secure: {
    label: 'Secure store',
    temp_min: null,
    temp_max: null,
    access_level: 'secure',
    quarantine: false,
    feature_toggles: {
      ...BASE_TOGGLES,
      door_monitoring: true,
      motion_detection: true,
      access_control: true,
    },
  },
  hazmat: {
    label: 'Hazmat store',
    temp_min: 15,
    temp_max: 25,
    access_level: 'restricted',
    quarantine: false,
    feature_toggles: {
      ...BASE_TOGGLES,
      environmental_monitoring: true,
      threshold_alerts: true,
      access_control: true,
    },
  },
  quarantine: {
    label: 'Quarantine',
    temp_min: null,
    temp_max: null,
    access_level: 'restricted',
    quarantine: true,
    feature_toggles: {
      ...BASE_TOGGLES,
      access_control: true,
      quarantine_workflow: true,
    },
  },
  staging: {
    label: 'Staging area',
    temp_min: null,
    temp_max: null,
    access_level: 'open',
    quarantine: false,
    feature_toggles: { ...BASE_TOGGLES },
  },
  dock: {
    label: 'Loading dock',
    temp_min: null,
    temp_max: null,
    access_level: 'open',
    quarantine: false,
    feature_toggles: { ...BASE_TOGGLES, door_monitoring: true },
  },
  returns: {
    label: 'Returns holding',
    temp_min: null,
    temp_max: null,
    access_level: 'restricted',
    quarantine: false,
    feature_toggles: { ...BASE_TOGGLES, quarantine_workflow: true },
  },
  destruction: {
    label: 'Destruction bay',
    temp_min: null,
    temp_max: null,
    access_level: 'secure',
    quarantine: false,
    feature_toggles: {
      ...BASE_TOGGLES,
      access_control: true,
      destruction_log: true,
    },
  },
};

/**
 * Typical presets for a room type — temperature range, access level and
 * feature toggles. Used to pre-fill the room form; every field remains
 * editable. Returns fresh objects — callers may mutate freely.
 */
export function getRoomTypeDefaults(type: RoomType): RoomTypeDefaults {
  const d = ROOM_TYPE_DEFAULTS[type];
  return {
    ...d,
    feature_toggles: { ...d.feature_toggles },
  };
}

/** Human-readable label for a room type (badge text). */
export function roomTypeLabel(type: RoomType): string {
  return ROOM_TYPE_DEFAULTS[type].label;
}
