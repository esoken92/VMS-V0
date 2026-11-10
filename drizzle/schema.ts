/**
 * Drizzle schema — mirrors supabase/migrations/*.sql EXACTLY (table names,
 * column names, enum labels). Those SQL files remain the canonical DB init
 * via docker-compose /docker-entrypoint-initdb.d; this file is the typed
 * query interface plus the source for future drizzle-kit migrations.
 *
 * Delta vs the SQL baseline:
 *   - profiles.password_hash  — argon2id hash for Auth.js credentials auth,
 *     added via drizzle migration 0000_local_auth (spec requires it here,
 *     not in the SQL baseline).
 *   - auth.users              — created by 000_bootstrap.sql (Supabase stub).
 *     Stores the login email + last_sign_in_at; passwords live on profiles.
 *
 * Note: `numeric`/`decimal` columns map to `string` under postgres.js to
 * preserve precision. Server actions convert to `number` at the DTO
 * boundary in lib/types.ts.
 */

import { sql } from 'drizzle-orm';
import {
  pgSchema,
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
  unique,
  uniqueIndex,
  index,
  primaryKey,
  check,
  pgEnum,
} from 'drizzle-orm/pg-core';

// ============================================================================
// ENUMS (labels must match the SQL CREATE TYPE / ALTER TYPE exactly)
// ============================================================================

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'manager',
  'admin',
  'fleet_dispatch',
  'staff',
]);

export const itemTypeEnum = pgEnum('item_type', [
  'consumable',
  'fluid',
  'tool',
  'tire',
]);

export const movementTypeEnum = pgEnum('movement_type', [
  'inbound',
  'outbound',
  'adjustment',
  'scrap',
  'tool_checkout',
  'receiving',
  'transfer',
  'kit_consume',
  'kit_produce',
]);

export const transferStatusEnum = pgEnum('transfer_status', [
  'draft',
  'dispatched',
  'received',
  'cancelled',
]);

export const stockTakeStatusEnum = pgEnum('stock_take_status', [
  'open',
  'completed',
]);

export const receivingStatusEnum = pgEnum('receiving_status', [
  'pending',
  'in_progress',
  'completed',
  'discrepancy',
]);

// ============================================================================
// auth.users (stub created by supabase/migrations/000_bootstrap.sql)
// Convention: profiles.id == auth.users.id (1:1 identity).
// ============================================================================

export const authSchema = pgSchema('auth');

export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  encryptedPassword: text('encrypted_password'),
  emailConfirmedAt: timestamp('email_confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastSignInAt: timestamp('last_sign_in_at', { withTimezone: true }),
});

// ============================================================================
// PUBLIC TABLES
// ============================================================================

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id, { onDelete: 'cascade' }),
  role: userRoleEnum('role').notNull().default('staff'),
  fullName: text('full_name').notNull(),
  /** argon2id hash — added by drizzle migration 0000_local_auth */
  passwordHash: text('password_hash'),
  /** alert preference columns added by supabase migration 009 */
  alertLowStock: boolean('alert_low_stock').default(true),
  alertOverdueTools: boolean('alert_overdue_tools').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactEmail: text('contact_email'),
  phone: text('phone'),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const binLocations = pgTable(
  'bin_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    zone: text('zone').notNull(),
    binLocation: text('bin_location').notNull(),
    maxWeightKg: numeric('max_weight_kg', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    description: text('description'),
  },
  (t) => [unique().on(t.zone, t.binLocation)],
);

export const unitConversions = pgTable(
  'unit_conversions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fromUnit: text('from_unit').notNull(),
    toUnit: text('to_unit').notNull(),
    conversionFactor: numeric('conversion_factor', {
      precision: 15,
      scale: 4,
    }).notNull(),
  },
  (t) => [unique().on(t.fromUnit, t.toUnit)],
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id').references(() => suppliers.id, {
      onDelete: 'set null',
    }),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    itemType: itemTypeEnum('item_type').notNull(),
    currentStock: numeric('current_stock', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    minThreshold: numeric('min_threshold', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    averageCost: numeric('average_cost', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    unitOfMeasure: text('unit_of_measure').notNull(),
    issuingUnit: text('issuing_unit').notNull(),
    binLocationId: uuid('bin_location_id').references(() => binLocations.id, {
      onDelete: 'set null',
    }),
    weightPerUnitKg: numeric('weight_per_unit_kg', { precision: 10, scale: 2 })
      .notNull()
      .default('0'),
    carriesCoreCharge: boolean('carries_core_charge').notNull().default(false),
    coreChargeAmount: numeric('core_charge_amount', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    lastMovementDate: timestamp('last_movement_date', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_products_sku').on(t.sku),
    index('idx_products_supplier').on(t.supplierId),
    index('idx_products_bin_location').on(t.binLocationId),
    index('idx_products_item_type').on(t.itemType),
  ],
);

export const toolLoans = pgTable(
  'tool_loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    toolProductId: uuid('tool_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    workerProfileId: uuid('worker_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    checkedOutByUserId: uuid('checked_out_by_user_id')
      .notNull()
      .references(() => profiles.id),
    checkedOutAt: timestamp('checked_out_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expectedReturnAt: timestamp('expected_return_at', { withTimezone: true }),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    conditionOnCheckout: text('condition_on_checkout'),
    conditionOnReturn: text('condition_on_return'),
    notes: text('notes'),
  },
  (t) => [
    index('idx_tool_loans_tool').on(t.toolProductId),
    index('idx_tool_loans_worker').on(t.workerProfileId),
    index('idx_tool_loans_status').on(t.returnedAt),
  ],
);

export const receivingDocuments = pgTable(
  'receiving_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    receivedByUserId: uuid('received_by_user_id')
      .notNull()
      .references(() => profiles.id),
    status: receivingStatusEnum('status').notNull().default('pending'),
    supplierInvoiceNumber: text('supplier_invoice_number'),
    expectedAt: timestamp('expected_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_receiving_documents_supplier').on(t.supplierId)],
);

export const receivingItems = pgTable(
  'receiving_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    receivingDocumentId: uuid('receiving_document_id')
      .notNull()
      .references(() => receivingDocuments.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    expectedQuantity: numeric('expected_quantity', { precision: 15, scale: 4 }).notNull(),
    receivedQuantity: numeric('received_quantity', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    unitOfMeasure: text('unit_of_measure').notNull(),
    damageReport: text('damage_report'),
    photoUrl: text('photo_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [index('idx_receiving_items_document').on(t.receivingDocumentId)],
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id),
    impersonatedByUserId: uuid('impersonated_by_user_id').references(
      () => profiles.id,
      { onDelete: 'set null' },
    ),
    type: movementTypeEnum('type').notNull(),
    quantity: numeric('quantity', { precision: 15, scale: 4 }).notNull(),
    reason: text('reason'),
    scrapImageUrl: text('scrap_image_url'),
    receivingItemId: uuid('receiving_item_id').references(
      () => receivingItems.id,
      { onDelete: 'set null' },
    ),
    toolLoanId: uuid('tool_loan_id').references(() => toolLoans.id, {
      onDelete: 'set null',
    }),
    binLocationId: uuid('bin_location_id').references(() => binLocations.id, {
      onDelete: 'set null',
    }),
    transferItemId: uuid('transfer_item_id').references(
      () => transferItems.id,
      { onDelete: 'set null' },
    ),
    clientRef: text('client_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_stock_movements_product').on(t.productId),
    index('idx_stock_movements_user').on(t.userId),
    index('idx_stock_movements_type').on(t.type),
    index('idx_stock_movements_created_at').on(t.createdAt),
    index('idx_stock_movements_bin').on(t.binLocationId),
    index('idx_stock_movements_transfer_item').on(t.transferItemId),
    uniqueIndex('ux_stock_movements_client_ref')
      .on(t.clientRef)
      .where(sql`client_ref is not null`),
  ],
);

export const stockTakes = pgTable('stock_takes', {
  id: uuid('id').primaryKey().defaultRandom(),
  startedBy: uuid('started_by')
    .notNull()
    .references(() => profiles.id),
  status: stockTakeStatusEnum('status').notNull().default('open'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  notes: text('notes'),
});

export const stockTakeItems = pgTable(
  'stock_take_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    stockTakeId: uuid('stock_take_id')
      .notNull()
      .references(() => stockTakes.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    systemQty: numeric('system_qty', { precision: 15, scale: 4 }).notNull(),
    physicalQty: numeric('physical_qty', { precision: 15, scale: 4 }),
    variance: numeric('variance', { precision: 15, scale: 4 }),
    countedBy: uuid('counted_by').references(() => profiles.id),
    countedAt: timestamp('counted_at', { withTimezone: true }),
  },
  (t) => [
    unique().on(t.stockTakeId, t.productId),
    index('idx_stock_take_items_stock_take').on(t.stockTakeId),
  ],
);

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    impersonatedByUserId: uuid('impersonated_by_user_id').references(
      () => profiles.id,
      { onDelete: 'set null' },
    ),
    actionType: text('action_type').notNull(),
    tableName: text('table_name').notNull(),
    recordId: uuid('record_id').notNull(),
    oldData: jsonb('old_data'),
    newData: jsonb('new_data'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_activity_logs_user').on(t.userId),
    index('idx_activity_logs_table').on(t.tableName),
    index('idx_activity_logs_created_at').on(t.createdAt),
  ],
);

export const systemSettings = pgTable('system_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  category: text('category').notNull().default('general'),
  description: text('description'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  updatedBy: uuid('updated_by').references(() => authUsers.id),
});

export const impersonationSessions = pgTable(
  'impersonation_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    impersonatorId: uuid('impersonator_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    reason: text('reason'),
  },
  (t) => [
    index('idx_impersonation_sessions_active')
      .on(t.endedAt)
      .where(sql`${t.endedAt} IS NULL`),
  ],
);

// ============================================================================
// 014 — transfers + kits (per-bin projection + documents + BOM)
// ============================================================================

export const productStock = pgTable(
  'product_stock',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    binLocationId: uuid('bin_location_id')
      .notNull()
      .references(() => binLocations.id, { onDelete: 'cascade' }),
    quantity: numeric('quantity', { precision: 15, scale: 4 })
      .notNull()
      .default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.binLocationId] }),
    index('idx_product_stock_bin').on(t.binLocationId),
  ],
);

export const transfers = pgTable(
  'transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transferNumber: text('transfer_number')
      .notNull()
      .default(sql`('TRF-' || lpad(nextval('transfer_number_seq')::text, 6, '0'))`),
    status: transferStatusEnum('status').notNull().default('draft'),
    fromBinLocationId: uuid('from_bin_location_id')
      .notNull()
      .references(() => binLocations.id),
    toBinLocationId: uuid('to_bin_location_id')
      .notNull()
      .references(() => binLocations.id),
    notes: text('notes'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id),
    dispatchedBy: uuid('dispatched_by').references(() => profiles.id),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    receivedBy: uuid('received_by').references(() => profiles.id),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    cancelledBy: uuid('cancelled_by').references(() => profiles.id),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    unique().on(t.transferNumber),
    check('transfers_bins_differ', sql`${t.fromBinLocationId} <> ${t.toBinLocationId}`),
    index('idx_transfers_status').on(t.status),
    index('idx_transfers_from').on(t.fromBinLocationId),
    index('idx_transfers_to').on(t.toBinLocationId),
  ],
);

export const transferItems = pgTable(
  'transfer_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transferId: uuid('transfer_id')
      .notNull()
      .references(() => transfers.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: numeric('quantity', { precision: 15, scale: 4 }).notNull(),
    dispatchedQuantity: numeric('dispatched_quantity', {
      precision: 15,
      scale: 4,
    })
      .notNull()
      .default('0'),
    receivedQuantity: numeric('received_quantity', {
      precision: 15,
      scale: 4,
    })
      .notNull()
      .default('0'),
  },
  (t) => [
    index('idx_transfer_items_transfer').on(t.transferId),
    index('idx_transfer_items_product').on(t.productId),
  ],
);

export const productComponents = pgTable(
  'product_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kitProductId: uuid('kit_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    componentProductId: uuid('component_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: numeric('quantity', { precision: 15, scale: 4 }).notNull(),
  },
  (t) => [
    uniqueIndex('product_components_pair_key').on(t.kitProductId, t.componentProductId),
    check('product_components_not_self', sql`${t.kitProductId} <> ${t.componentProductId}`),
    index('idx_product_components_component').on(t.componentProductId),
  ],
);
