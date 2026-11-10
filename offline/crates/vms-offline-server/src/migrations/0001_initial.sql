-- 0001_initial — SQLite mirror of the core VMS schema (spec item 302).
--
-- Mirrors supabase/migrations/001_initial_schema.sql + drizzle/0003_storerooms.sql
-- column-for-column where practical. Deliberate deltas, all documented in
-- docs/OFFLINE-APP.md:
--   * UUIDs/enum/timestamptz/jsonb/numeric map to TEXT/INTEGER/REAL (SQLite
--     has no such types). Column NAMES are identical.
--   * profiles.email lives here (web keeps it on auth.users — Supabase
--     Auth's table, which cannot exist offline).
--   * sessions is an offline-only table (bearer token store).
--   * stock_movements keeps receiving_item_id / transfer_item_id columns but
--     WITHOUT FK clauses — those tables are not in the Tier-1 mirror.
--   * PG TEXT[] columns (storerooms.allowed_roles/item_allowlist) and JSONB
--     (feature_toggles, activity_logs.*_data) are stored as JSON text.

-- ============================================================================
-- PROFILES (001) — +email (offline), +password_hash (drizzle 0000_local_auth)
-- ============================================================================
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'staff'
        CHECK (role IN ('super_admin','manager','admin','fleet_dispatch','staff')),
  full_name TEXT NOT NULL,
  password_hash TEXT,
  alert_low_stock INTEGER NOT NULL DEFAULT 1,
  alert_overdue_tools INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================================================
-- SESSIONS — offline-only bearer token store (POST /api/v1/auth/login)
-- ============================================================================
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE INDEX idx_sessions_profile ON sessions(profile_id);

-- ============================================================================
-- SUPPLIERS (001)
-- ============================================================================
CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ============================================================================
-- STOREROOMS (drizzle 0003) — created BEFORE bin_locations for room_id FK
-- ============================================================================
CREATE TABLE storerooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general'
        CHECK (type IN ('general','cold','frozen','dry','it','vehicle','secure',
                        'hazmat','quarantine','staging','dock','returns','destruction')),
  parent_id TEXT REFERENCES storerooms(id) ON DELETE SET NULL,
  description TEXT,
  temp_min REAL,
  temp_max REAL,
  capacity_units INTEGER,
  access_level TEXT NOT NULL DEFAULT 'open'
        CHECK (access_level IN ('open','restricted','secure','locked')),
  allowed_roles TEXT NOT NULL DEFAULT '[]',      -- JSON array (PG TEXT[])
  item_allowlist TEXT NOT NULL DEFAULT '[]',     -- JSON array (PG TEXT[])
  feature_toggles TEXT NOT NULL DEFAULT '{}',    -- JSON object (PG JSONB)
  quarantine INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_storerooms_parent ON storerooms(parent_id);
CREATE INDEX idx_storerooms_type ON storerooms(type);
CREATE INDEX idx_storerooms_active ON storerooms(active);

-- ============================================================================
-- BIN_LOCATIONS (001 + room_id from drizzle 0003)
-- ============================================================================
CREATE TABLE bin_locations (
  id TEXT PRIMARY KEY,
  zone TEXT NOT NULL,
  bin_location TEXT NOT NULL,
  max_weight_kg REAL NOT NULL DEFAULT 0,
  description TEXT,
  room_id TEXT REFERENCES storerooms(id) ON DELETE SET NULL,
  UNIQUE(zone, bin_location)
);
CREATE INDEX idx_bin_locations_room ON bin_locations(room_id);

-- ============================================================================
-- UNIT_CONVERSIONS (001)
-- ============================================================================
CREATE TABLE unit_conversions (
  id TEXT PRIMARY KEY,
  from_unit TEXT NOT NULL,
  to_unit TEXT NOT NULL,
  conversion_factor REAL NOT NULL,
  UNIQUE(from_unit, to_unit)
);

-- ============================================================================
-- PRODUCTS (001)
-- ============================================================================
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  supplier_id TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('consumable','fluid','tool','tire')),
  current_stock REAL NOT NULL DEFAULT 0,
  min_threshold REAL NOT NULL DEFAULT 0,
  average_cost REAL NOT NULL DEFAULT 0,
  unit_of_measure TEXT NOT NULL,
  issuing_unit TEXT NOT NULL,
  bin_location_id TEXT REFERENCES bin_locations(id) ON DELETE SET NULL,
  weight_per_unit_kg REAL NOT NULL DEFAULT 0,
  carries_core_charge INTEGER NOT NULL DEFAULT 0,
  core_charge_amount REAL NOT NULL DEFAULT 0,
  last_movement_date TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_bin_location ON products(bin_location_id);
CREATE INDEX idx_products_item_type ON products(item_type);

-- ============================================================================
-- TOOL_LOANS (001)
-- ============================================================================
CREATE TABLE tool_loans (
  id TEXT PRIMARY KEY,
  tool_product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  worker_profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  checked_out_by_user_id TEXT NOT NULL REFERENCES profiles(id),
  checked_out_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expected_return_at TEXT,
  returned_at TEXT,
  condition_on_checkout TEXT,
  condition_on_return TEXT,
  notes TEXT
);
CREATE INDEX idx_tool_loans_tool ON tool_loans(tool_product_id);
CREATE INDEX idx_tool_loans_worker ON tool_loans(worker_profile_id);
CREATE INDEX idx_tool_loans_status ON tool_loans(returned_at);

-- ============================================================================
-- STOCK_MOVEMENTS (001 + bin_location_id/transfer_item_id from 014)
-- receiving_item_id / transfer_item_id kept as columns WITHOUT FK clauses —
-- receiving_items / transfer_items are not in the Tier-1 mirror.
-- ============================================================================
CREATE TABLE stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id),
  impersonated_by_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL
        CHECK (type IN ('inbound','outbound','adjustment','scrap','tool_checkout',
                        'receiving','transfer','kit_consume','kit_produce')),
  quantity REAL NOT NULL,
  reason TEXT,
  scrap_image_url TEXT,
  receiving_item_id TEXT,    -- no FK: receiving_items not ported (Tier-1)
  tool_loan_id TEXT REFERENCES tool_loans(id) ON DELETE SET NULL,
  bin_location_id TEXT REFERENCES bin_locations(id) ON DELETE SET NULL,
  transfer_item_id TEXT,     -- no FK: transfer_items not ported (Tier-1)
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_user ON stock_movements(user_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(type);
CREATE INDEX idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX idx_stock_movements_bin ON stock_movements(bin_location_id);

-- ============================================================================
-- STOCK_TAKES + STOCK_TAKE_ITEMS (001)
-- ============================================================================
CREATE TABLE stock_takes (
  id TEXT PRIMARY KEY,
  started_by TEXT NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed')),
  started_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  notes TEXT
);

CREATE TABLE stock_take_items (
  id TEXT PRIMARY KEY,
  stock_take_id TEXT NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  system_qty REAL NOT NULL,
  physical_qty REAL,
  variance REAL,
  counted_by TEXT REFERENCES profiles(id),
  counted_at TEXT,
  UNIQUE(stock_take_id, product_id)
);
CREATE INDEX idx_stock_take_items_stock_take ON stock_take_items(stock_take_id);

-- ============================================================================
-- ACTIVITY_LOGS (001) — old_data/new_data as JSON text
-- ============================================================================
CREATE TABLE activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  impersonated_by_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  old_data TEXT,
  new_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_table ON activity_logs(table_name);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
