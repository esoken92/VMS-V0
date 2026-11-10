import { and, asc, desc, eq, gt, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  activityLogs,
  binLocations,
  products,
  profiles,
  stockMovements,
  stockTakes,
  toolLoans,
  transfers,
} from '@/drizzle/schema';
import type { Permission } from '@/lib/auth/permissions';

/**
 * Custom-report dataset registry — the report builder (roadmap 2o) is a
 * dataset → filters → table → CSV/PDF pipeline instead of N bespoke pages.
 * Each dataset declares its columns, its filters, and ONE bounded query.
 * Dead-stock and audit-log export land here too (items 59/61).
 *
 * Every loader is capped at ROW_CAP — reports page through the app, not
 * the whole table; PDFs stay readable.
 */

export const ROW_CAP = 2000;

export interface ReportColumn {
  key: string;
  label: string;
}

export interface FilterDef {
  key: string;
  label: string;
  type: 'number' | 'select';
  /** select-type options */
  options?: { value: string; label: string }[];
  default?: string;
  placeholder?: string;
}

export interface DatasetMeta {
  id: string;
  label: string;
  description: string;
  permission: Permission;
  columns: ReportColumn[];
  filters: FilterDef[];
}

type Filters = Record<string, string | number | undefined>;
type Row = Record<string, string | number | null>;

interface Dataset extends DatasetMeta {
  run: (f: Filters) => Promise<Row[]>;
}

const sinceDays = (f: Filters, fallback = 30) => {
  const d = Math.min(Math.max(Number(f.days ?? fallback), 1), 365);
  return new Date(Date.now() - d * 864e5);
};

const DAY_FILTER: FilterDef = {
  key: 'days',
  label: 'Days back',
  type: 'number',
  default: '30',
  placeholder: '30',
};

const DATASETS: Dataset[] = [
  {
    id: 'stock_snapshot',
    label: 'Stock snapshot',
    description: 'Every product: on-hand, threshold, bin, unit cost, line value.',
    permission: 'reports:read',
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Item' },
      { key: 'item_type', label: 'Type' },
      { key: 'current_stock', label: 'Stock' },
      { key: 'unit', label: 'Unit' },
      { key: 'bin', label: 'Location' },
      { key: 'min_threshold', label: 'Min' },
      { key: 'avg_cost', label: 'Avg cost' },
      { key: 'value', label: 'Value' },
    ],
    filters: [],
    run: async () =>
      db
        .select({
          sku: products.sku,
          name: products.name,
          item_type: products.itemType,
          current_stock: products.currentStock,
          unit: products.unitOfMeasure,
          bin: sql<string>`CASE WHEN ${binLocations.zone} IS NULL THEN '—' ELSE ${binLocations.zone} || ' / ' || ${binLocations.binLocation} END`,
          min_threshold: products.minThreshold,
          avg_cost: products.averageCost,
          value: sql<string>`(${products.currentStock} * ${products.averageCost})::numeric(15,2)`,
        })
        .from(products)
        .leftJoin(binLocations, eq(products.binLocationId, binLocations.id))
        .orderBy(asc(products.sku))
        .limit(ROW_CAP),
  },
  {
    id: 'movements',
    label: 'Movement log',
    description: 'Ledger entries with product, user, and reason — windowed.',
    permission: 'reports:read',
    columns: [
      { key: 'when', label: 'When' },
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Item' },
      { key: 'type', label: 'Type' },
      { key: 'quantity', label: 'Qty' },
      { key: 'reason', label: 'Reason' },
      { key: 'user_name', label: 'By' },
    ],
    filters: [
      DAY_FILTER,
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: '', label: 'All types' },
          ...['inbound', 'outbound', 'adjustment', 'scrap', 'tool_checkout', 'receiving', 'transfer', 'kit_consume', 'kit_produce'].map(
            (t) => ({ value: t, label: t.replace(/_/g, ' ') }),
          ),
        ],
      },
    ],
    run: async (f) => {
      const conds = [gt(stockMovements.createdAt, sinceDays(f))];
      if (f.type) conds.push(sql`${stockMovements.type} = ${String(f.type)}`);
      return db
        .select({
          when: sql<string>`to_char(${stockMovements.createdAt}, 'YYYY-MM-DD HH24:MI')`,
          sku: products.sku,
          name: products.name,
          type: stockMovements.type,
          quantity: stockMovements.quantity,
          reason: stockMovements.reason,
          user_name: profiles.fullName,
        })
        .from(stockMovements)
        .leftJoin(products, eq(stockMovements.productId, products.id))
        .leftJoin(profiles, eq(stockMovements.userId, profiles.id))
        .where(and(...conds))
        .orderBy(desc(stockMovements.createdAt))
        .limit(ROW_CAP);
    },
  },
  {
    id: 'low_stock',
    label: 'Low stock',
    description: 'Products at or below their reorder threshold.',
    permission: 'reports:read',
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Item' },
      { key: 'current_stock', label: 'Stock' },
      { key: 'min_threshold', label: 'Min' },
      { key: 'shortfall', label: 'Shortfall' },
      { key: 'unit', label: 'Unit' },
      { key: 'bin', label: 'Location' },
    ],
    filters: [],
    run: async () =>
      db
        .select({
          sku: products.sku,
          name: products.name,
          current_stock: products.currentStock,
          min_threshold: products.minThreshold,
          shortfall: sql<string>`(${products.minThreshold} - ${products.currentStock})::numeric(15,4)`,
          unit: products.unitOfMeasure,
          bin: sql<string>`CASE WHEN ${binLocations.zone} IS NULL THEN '—' ELSE ${binLocations.zone} || ' / ' || ${binLocations.binLocation} END`,
        })
        .from(products)
        .leftJoin(binLocations, eq(products.binLocationId, binLocations.id))
        .where(lte(products.currentStock, products.minThreshold))
        .orderBy(asc(products.sku))
        .limit(ROW_CAP),
  },
  {
    id: 'dead_stock',
    label: 'Dead stock',
    description: 'No movement in N days — obsolescence candidates (roadmap 59).',
    permission: 'reports:read',
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Item' },
      { key: 'current_stock', label: 'Stock' },
      { key: 'value', label: 'Value' },
      { key: 'last_movement', label: 'Last movement' },
      { key: 'bin', label: 'Location' },
    ],
    filters: [{ ...DAY_FILTER, label: 'Idle for ≥ days', default: '90', placeholder: '90' }],
    run: async (f) => {
      const cutoff = sinceDays(f, 90);
      return db
        .select({
          sku: products.sku,
          name: products.name,
          current_stock: products.currentStock,
          value: sql<string>`(${products.currentStock} * ${products.averageCost})::numeric(15,2)`,
          last_movement: sql<string>`COALESCE(to_char(${products.lastMovementDate}, 'YYYY-MM-DD'), 'never')`,
          bin: sql<string>`CASE WHEN ${binLocations.zone} IS NULL THEN '—' ELSE ${binLocations.zone} || ' / ' || ${binLocations.binLocation} END`,
        })
        .from(products)
        .leftJoin(binLocations, eq(products.binLocationId, binLocations.id))
        .where(
          and(
            sql`${products.currentStock} > 0`,
            sql`(${products.lastMovementDate} IS NULL OR ${products.lastMovementDate} < ${cutoff})`,
          ),
        )
        .orderBy(asc(products.sku))
        .limit(ROW_CAP);
    },
  },
  {
    id: 'stock_takes',
    label: 'Stock-take variance',
    description: 'Count sessions: items counted, units + value of variance.',
    permission: 'reports:read',
    columns: [
      { key: 'id', label: 'Take' },
      { key: 'status', label: 'Status' },
      { key: 'started_at', label: 'Started' },
      { key: 'completed_at', label: 'Completed' },
      { key: 'started_by', label: 'By' },
      { key: 'items', label: 'Items' },
      { key: 'variance_units', label: 'Variance' },
    ],
    filters: [DAY_FILTER],
    run: async (f) =>
      db
        .select({
          id: sql<string>`'ST-' || left(${stockTakes.id}::text, 8)`,
          status: stockTakes.status,
          started_at: sql<string>`to_char(${stockTakes.startedAt}, 'YYYY-MM-DD HH24:MI')`,
          completed_at: sql<string>`COALESCE(to_char(${stockTakes.completedAt}, 'YYYY-MM-DD HH24:MI'), '—')`,
          started_by: profiles.fullName,
          items: sql<string>`(SELECT count(*) FROM stock_take_items sti WHERE sti.stock_take_id = ${stockTakes.id})`,
          variance_units: sql<string>`COALESCE((SELECT SUM(sti.variance) FROM stock_take_items sti WHERE sti.stock_take_id = ${stockTakes.id}), 0)::numeric(15,4)`,
        })
        .from(stockTakes)
        .leftJoin(profiles, eq(stockTakes.startedBy, profiles.id))
        .where(gt(stockTakes.startedAt, sinceDays(f, 180)))
        .orderBy(desc(stockTakes.startedAt))
        .limit(ROW_CAP),
  },
  {
    id: 'tool_loans',
    label: 'Tool loans',
    description: 'Checkout register — open and returned loans.',
    permission: 'reports:read',
    columns: [
      { key: 'tool', label: 'Tool' },
      { key: 'worker', label: 'Worker' },
      { key: 'checked_out', label: 'Out' },
      { key: 'expected', label: 'Due' },
      { key: 'returned', label: 'Returned' },
      { key: 'status', label: 'Status' },
    ],
    filters: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: '', label: 'All' },
          { value: 'open', label: 'Open' },
          { value: 'returned', label: 'Returned' },
        ],
      },
    ],
    run: async (f) => {
      const conds = [];
      if (f.status === 'open') conds.push(isNull(toolLoans.returnedAt));
      if (f.status === 'returned') conds.push(isNotNull(toolLoans.returnedAt));
      const worker = profiles;
      return db
        .select({
          tool: sql<string>`${products.sku} || ' — ' || ${products.name}`,
          worker: worker.fullName,
          checked_out: sql<string>`to_char(${toolLoans.checkedOutAt}, 'YYYY-MM-DD HH24:MI')`,
          expected: sql<string>`COALESCE(to_char(${toolLoans.expectedReturnAt}, 'YYYY-MM-DD'), '—')`,
          returned: sql<string>`COALESCE(to_char(${toolLoans.returnedAt}, 'YYYY-MM-DD HH24:MI'), '—')`,
          status: sql<string>`CASE WHEN ${toolLoans.returnedAt} IS NULL THEN 'open' ELSE 'returned' END`,
        })
        .from(toolLoans)
        .leftJoin(products, eq(toolLoans.toolProductId, products.id))
        .leftJoin(worker, eq(toolLoans.workerProfileId, worker.id))
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(desc(toolLoans.checkedOutAt))
        .limit(ROW_CAP);
    },
  },
  {
    id: 'transfers',
    label: 'Transfers',
    description: 'Transfer documents with route and custody state.',
    permission: 'transfers:read',
    columns: [
      { key: 'number', label: 'Transfer' },
      { key: 'route', label: 'Route' },
      { key: 'status', label: 'Status' },
      { key: 'items', label: 'Items' },
      { key: 'created', label: 'Created' },
      { key: 'received', label: 'Received' },
    ],
    filters: [DAY_FILTER],
    run: async (f) =>
      db
        .select({
          number: transfers.transferNumber,
          route: sql<string>`(SELECT fb.zone || ' / ' || fb.bin_location FROM bin_locations fb WHERE fb.id = ${transfers.fromBinLocationId}) || ' → ' || (SELECT tb.zone || ' / ' || tb.bin_location FROM bin_locations tb WHERE tb.id = ${transfers.toBinLocationId})`,
          status: transfers.status,
          items: sql<string>`(SELECT count(*) FROM transfer_items ti WHERE ti.transfer_id = ${transfers.id})`,
          created: sql<string>`to_char(${transfers.createdAt}, 'YYYY-MM-DD')`,
          received: sql<string>`COALESCE(to_char(${transfers.receivedAt}, 'YYYY-MM-DD'), '—')`,
        })
        .from(transfers)
        .where(gt(transfers.createdAt, sinceDays(f, 180)))
        .orderBy(desc(transfers.createdAt))
        .limit(ROW_CAP),
  },
  {
    id: 'activity_log',
    label: 'Audit log',
    description: 'Append-only activity log — who changed what, when (item 61).',
    permission: 'activity_logs:read',
    columns: [
      { key: 'when', label: 'When' },
      { key: 'user', label: 'User' },
      { key: 'action', label: 'Action' },
      { key: 'table', label: 'Table' },
      { key: 'record', label: 'Record' },
    ],
    filters: [DAY_FILTER],
    run: async (f) =>
      db
        .select({
          when: sql<string>`to_char(${activityLogs.createdAt}, 'YYYY-MM-DD HH24:MI')`,
          user: profiles.fullName,
          action: activityLogs.actionType,
          table: activityLogs.tableName,
          record: sql<string>`left(${activityLogs.recordId}::text, 8)`,
        })
        .from(activityLogs)
        .leftJoin(profiles, eq(activityLogs.userId, profiles.id))
        .where(gt(activityLogs.createdAt, sinceDays(f)))
        .orderBy(desc(activityLogs.createdAt))
        .limit(ROW_CAP),
  },
];

const byId = new Map(DATASETS.map((d) => [d.id, d]));

export function listDatasetMetas(): DatasetMeta[] {
  return DATASETS.map(({ id, label, description, permission, columns, filters }) => ({
    id,
    label,
    description,
    permission,
    columns,
    filters,
  }));
}

export function getDataset(id: string): Dataset | undefined {
  return byId.get(id);
}
