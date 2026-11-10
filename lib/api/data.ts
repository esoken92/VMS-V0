/**
 * lib/api/data — data operations shared by the REST v1 routes and the MCP
 * tools. Every function takes an ApiPrincipal (from lib/api/auth) and
 * re-checks the app-layer permission matrix BEFORE touching the DB —
 * identical rules to lib/actions/*, just driven by the credential rather
 * than the session helpers (which can't see API keys).
 *
 * Scoping parity with the server actions / old RLS:
 *   - roles without stock_movements:read:all see only their own movements
 *   - roles without tool_loans:read:all   see only loans they hold
 *   - tool checkout for another worker   needs tool_loans:create:for_other
 *   - tool return for another worker     needs tool_loans:return:any
 *   - movement type creation             needs canCreateMovement(role, type)
 *   - audit log                          admin/super_admin role only
 */

import { and, asc, desc, eq, gte, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '@/lib/db';
import {
  activityLogs,
  binLocations,
  products,
  profiles,
  stockMovements,
  stockTakeItems,
  stockTakes,
  toolLoans,
} from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { can, canCreateMovement, type Permission } from '@/lib/auth/permissions';
import type { MovementType } from '@/lib/auth/roles';
import { ApiError } from './http';
import type { ApiPrincipal } from './auth';
import type {
  ActivityLogDTO,
  BinLocationDTO,
  ProductDTO,
  StockMovementDTO,
  StockTakeDTO,
  StockTakeItemDTO,
  ToolLoanDTO,
} from '@/lib/types';

const worker = alias(profiles, 'worker');
const checker = alias(profiles, 'checker');
const impersonator = alias(profiles, 'impersonator');

/** Role-matrix check — the same `can()` the server actions use. */
function requirePerm(principal: ApiPrincipal, permission: Permission): void {
  if (!can(principal.role, permission)) {
    throw new ApiError(
      'forbidden',
      `Role '${principal.role}' lacks permission '${permission}'`,
    );
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

// ============================================================================
// Products
// ============================================================================

const productCoreSelect = {
  id: products.id,
  sku: products.sku,
  name: products.name,
  item_type: products.itemType,
  current_stock: products.currentStock,
  min_threshold: products.minThreshold,
  average_cost: products.averageCost,
  unit_of_measure: products.unitOfMeasure,
  issuing_unit: products.issuingUnit,
  bin_location_id: products.binLocationId,
  supplier_id: products.supplierId,
  weight_per_unit_kg: products.weightPerUnitKg,
  carries_core_charge: products.carriesCoreCharge,
  core_charge_amount: products.coreChargeAmount,
  last_movement_date: products.lastMovementDate,
} as const;

/** productCoreSelect + bin-location labels (requires the join). */
const productSelect = {
  ...productCoreSelect,
  zone: binLocations.zone,
  bin_location: binLocations.binLocation,
} as const;

export interface ApiProductDTO extends ProductDTO {
  zone: string | null;
  bin_location: string | null;
}

function toProductDTO(r: {
  id: string;
  sku: string;
  name: string;
  item_type: ProductDTO['item_type'];
  current_stock: string;
  min_threshold: string;
  average_cost: string;
  unit_of_measure: string;
  issuing_unit: string;
  bin_location_id: string | null;
  supplier_id: string | null;
  weight_per_unit_kg: string;
  carries_core_charge: boolean;
  core_charge_amount: string;
  last_movement_date: Date | null;
  zone: string | null;
  bin_location: string | null;
}): ApiProductDTO {
  return {
    id: r.id,
    sku: r.sku,
    name: r.name,
    item_type: r.item_type,
    current_stock: Number(r.current_stock),
    min_threshold: Number(r.min_threshold),
    average_cost: Number(r.average_cost),
    unit_of_measure: r.unit_of_measure,
    issuing_unit: r.issuing_unit,
    bin_location_id: r.bin_location_id,
    supplier_id: r.supplier_id,
    weight_per_unit_kg: Number(r.weight_per_unit_kg),
    carries_core_charge: r.carries_core_charge,
    core_charge_amount: Number(r.core_charge_amount),
    last_movement_date: r.last_movement_date?.toISOString() ?? null,
    zone: r.zone,
    bin_location: r.bin_location,
  };
}

export async function apiListProducts(
  principal: ApiPrincipal,
  opts: { query?: string; itemType?: string; limit?: number; offset?: number } = {},
): Promise<ApiProductDTO[]> {
  requirePerm(principal, 'products:read');
  const limit = clamp(opts.limit ?? 100, 1, 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const conditions = [];
  if (opts.query) {
    const pattern = `%${opts.query}%`;
    conditions.push(or(ilike(products.sku, pattern), ilike(products.name, pattern)));
  }
  if (opts.itemType) {
    conditions.push(
      eq(products.itemType, opts.itemType as ProductDTO['item_type']),
    );
  }

  const rows = await db
    .select(productSelect)
    .from(products)
    .leftJoin(binLocations, eq(products.binLocationId, binLocations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(products.sku))
    .limit(limit)
    .offset(offset);

  return rows.map(toProductDTO);
}

export interface UpsertProductInput {
  id?: string;
  sku: string;
  name: string;
  itemType: ProductDTO['item_type'];
  currentStock?: number;
  minThreshold: number;
  averageCost: number;
  unitOfMeasure: string;
  issuingUnit: string;
  supplierId?: string | null;
  binLocationId?: string | null;
}

export async function apiUpsertProduct(
  principal: ApiPrincipal,
  input: UpsertProductInput,
): Promise<ApiProductDTO> {
  requirePerm(principal, 'products:write');

  const saved = await db.transaction(async (tx) => {
    await setAuditContext(tx, {
      userId: principal.profileId,
      impersonatorId: principal.impersonatorId,
    });
    const values = {
      sku: input.sku,
      name: input.name,
      itemType: input.itemType,
      ...(input.currentStock !== undefined
        ? { currentStock: String(input.currentStock) }
        : {}),
      minThreshold: String(input.minThreshold),
      averageCost: String(input.averageCost),
      unitOfMeasure: input.unitOfMeasure,
      issuingUnit: input.issuingUnit,
      supplierId: input.supplierId ?? null,
      binLocationId: input.binLocationId ?? null,
    };
    if (input.id) {
      const [row] = await tx
        .update(products)
        .set(values)
        .where(eq(products.id, input.id))
        .returning(productCoreSelect);
      return row ?? null;
    }
    const [row] = await tx
      .insert(products)
      .values({ ...values, currentStock: String(input.currentStock ?? 0) })
      .returning(productCoreSelect);
    return row ?? null;
  });

  if (!saved) throw new ApiError('not_found', 'Product not found');
  return toProductDTO({ ...saved, zone: null, bin_location: null });
}

export async function apiGetProduct(
  principal: ApiPrincipal,
  idOrSku: string,
): Promise<ApiProductDTO> {
  requirePerm(principal, 'products:read');
  const isUuid =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
      idOrSku,
    );
  const rows = await db
    .select(productSelect)
    .from(products)
    .leftJoin(binLocations, eq(products.binLocationId, binLocations.id))
    .where(isUuid ? eq(products.id, idOrSku) : eq(products.sku, idOrSku))
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('not_found', 'Product not found');
  return toProductDTO(row);
}

// ============================================================================
// Stock levels
// ============================================================================

export interface StockLevelDTO {
  product_id: string;
  sku: string;
  name: string;
  item_type: string;
  current_stock: number;
  min_threshold: number;
  unit_of_measure: string;
  low: boolean;
}

export async function apiListStockLevels(
  principal: ApiPrincipal,
  opts: { onlyLow?: boolean; limit?: number } = {},
): Promise<StockLevelDTO[]> {
  requirePerm(principal, 'products:read');
  const rows = await db
    .select({
      product_id: products.id,
      sku: products.sku,
      name: products.name,
      item_type: products.itemType,
      current_stock: products.currentStock,
      min_threshold: products.minThreshold,
      unit_of_measure: products.unitOfMeasure,
      low: sql<boolean>`${products.currentStock} <= ${products.minThreshold}`,
    })
    .from(products)
    .where(
      opts.onlyLow
        ? sql`${products.currentStock} <= ${products.minThreshold}`
        : undefined,
    )
    .orderBy(asc(products.sku))
    .limit(clamp(opts.limit ?? 500, 1, 1000));

  return rows.map((r) => ({
    ...r,
    current_stock: Number(r.current_stock),
    min_threshold: Number(r.min_threshold),
    low: Boolean(r.low),
  }));
}

// ============================================================================
// Stock movements
// ============================================================================

function toMovementDTO(r: {
  id: string;
  product_id: string;
  product_sku: string | null;
  product_name: string | null;
  product_unit: string | null;
  user_id: string;
  user_name: string | null;
  type: StockMovementDTO['type'];
  quantity: string;
  reason: string | null;
  scrap_image_url: string | null;
  created_at: Date | null;
}): StockMovementDTO {
  return {
    ...r,
    quantity: Number(r.quantity),
    created_at: r.created_at?.toISOString() ?? null,
  };
}

const movementSelect = {
  id: stockMovements.id,
  product_id: stockMovements.productId,
  product_sku: products.sku,
  product_name: products.name,
  product_unit: products.unitOfMeasure,
  user_id: stockMovements.userId,
  user_name: profiles.fullName,
  type: stockMovements.type,
  quantity: stockMovements.quantity,
  reason: stockMovements.reason,
  scrap_image_url: stockMovements.scrapImageUrl,
  created_at: stockMovements.createdAt,
} as const;

export async function apiListMovements(
  principal: ApiPrincipal,
  opts: { limit?: number; productId?: string; days?: number } = {},
): Promise<StockMovementDTO[]> {
  requirePerm(principal, 'products:read'); // catalog read = movement read baseline
  const seeAll = can(principal.role, 'stock_movements:read:all');
  const conditions = [];
  if (!seeAll) conditions.push(eq(stockMovements.userId, principal.profileId));
  if (opts.productId) conditions.push(eq(stockMovements.productId, opts.productId));
  if (opts.days) {
    const since = new Date(Date.now() - clamp(opts.days, 1, 365) * 864e5);
    conditions.push(gte(stockMovements.createdAt, since));
  }

  const rows = await db
    .select(movementSelect)
    .from(stockMovements)
    .leftJoin(products, eq(stockMovements.productId, products.id))
    .leftJoin(profiles, eq(stockMovements.userId, profiles.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(stockMovements.createdAt))
    .limit(clamp(opts.limit ?? 50, 1, 200));

  return rows.map(toMovementDTO);
}

export interface CreateMovementInput {
  productId?: string;
  sku?: string;
  type: MovementType;
  quantity: number;
  reason?: string | null;
  scrapImageUrl?: string | null;
}

export async function apiCreateMovement(
  principal: ApiPrincipal,
  input: CreateMovementInput,
): Promise<{ movement_id: string; new_stock: number }> {
  if (!canCreateMovement(principal.role, input.type)) {
    throw new ApiError(
      'forbidden',
      `Role '${principal.role}' cannot record ${input.type} movements`,
    );
  }
  if (!input.productId && !input.sku) {
    throw new ApiError('validation', 'Provide product_id or sku');
  }

  const signedQty =
    input.type === 'inbound' || input.type === 'receiving' || input.type === 'adjustment'
      ? Math.abs(input.quantity)
      : -Math.abs(input.quantity);

  return db.transaction(async (tx) => {
    await setAuditContext(tx, {
      userId: principal.profileId,
      impersonatorId: principal.impersonatorId,
    });

    const [product] = await tx
      .select({ id: products.id, current_stock: products.currentStock })
      .from(products)
      .where(
        input.productId
          ? eq(products.id, input.productId)
          : eq(products.sku, input.sku ?? ''),
      )
      .for('update')
      .limit(1);
    if (!product) throw new ApiError('not_found', 'Product not found');

    const newStock = Number(product.current_stock) + signedQty;
    if (newStock < 0) throw new ApiError('conflict', 'Insufficient stock');

    const [movement] = await tx
      .insert(stockMovements)
      .values({
        productId: product.id,
        userId: principal.profileId,
        impersonatedByUserId: principal.impersonatorId,
        type: input.type,
        quantity: String(signedQty),
        reason: input.reason || null,
        scrapImageUrl: input.scrapImageUrl || null,
      })
      .returning({ id: stockMovements.id });

    await tx
      .update(products)
      .set({ currentStock: String(newStock), lastMovementDate: new Date() })
      .where(eq(products.id, product.id));

    return { movement_id: movement.id, new_stock: newStock };
  });
}

// ============================================================================
// Tool loans
// ============================================================================

const loanSelect = {
  id: toolLoans.id,
  tool_product_id: toolLoans.toolProductId,
  product_sku: products.sku,
  product_name: products.name,
  worker_profile_id: toolLoans.workerProfileId,
  worker_name: worker.fullName,
  checked_out_by_user_id: toolLoans.checkedOutByUserId,
  checked_out_by_name: checker.fullName,
  checked_out_at: toolLoans.checkedOutAt,
  expected_return_at: toolLoans.expectedReturnAt,
  returned_at: toolLoans.returnedAt,
  condition_on_checkout: toolLoans.conditionOnCheckout,
  condition_on_return: toolLoans.conditionOnReturn,
  notes: toolLoans.notes,
} as const;

function toLoanDTO(r: {
  id: string;
  tool_product_id: string;
  product_sku: string | null;
  product_name: string | null;
  worker_profile_id: string;
  worker_name: string | null;
  checked_out_by_user_id: string;
  checked_out_by_name: string | null;
  checked_out_at: Date | null;
  expected_return_at: Date | null;
  returned_at: Date | null;
  condition_on_checkout: string | null;
  condition_on_return: string | null;
  notes: string | null;
}): ToolLoanDTO {
  return {
    ...r,
    checked_out_at: r.checked_out_at?.toISOString() ?? null,
    expected_return_at: r.expected_return_at?.toISOString() ?? null,
    returned_at: r.returned_at?.toISOString() ?? null,
  };
}

export async function apiListLoans(
  principal: ApiPrincipal,
  opts: { activeOnly?: boolean; limit?: number } = {},
): Promise<ToolLoanDTO[]> {
  requirePerm(principal, 'products:read');
  const seeAll = can(principal.role, 'tool_loans:read:all');
  const conditions = [];
  if (!seeAll) conditions.push(eq(toolLoans.workerProfileId, principal.profileId));
  if (opts.activeOnly) conditions.push(isNull(toolLoans.returnedAt));

  const rows = await db
    .select(loanSelect)
    .from(toolLoans)
    .leftJoin(products, eq(toolLoans.toolProductId, products.id))
    .leftJoin(worker, eq(toolLoans.workerProfileId, worker.id))
    .leftJoin(checker, eq(toolLoans.checkedOutByUserId, checker.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(toolLoans.checkedOutAt))
    .limit(clamp(opts.limit ?? 200, 1, 500));

  return rows.map(toLoanDTO);
}

export interface CheckoutToolsInput {
  toolIds?: string[];
  toolSkus?: string[];
  workerProfileId?: string | null;
  expectedReturnAt?: string | null;
  conditionOnCheckout: string;
  notes?: string | null;
}

export async function apiCheckoutTools(
  principal: ApiPrincipal,
  input: CheckoutToolsInput,
): Promise<{ count: number; loan_ids: string[] }> {
  requirePerm(principal, 'tool_loans:create');
  const workerId = input.workerProfileId ?? principal.profileId;
  if (
    workerId !== principal.profileId &&
    !can(principal.role, 'tool_loans:create:for_other')
  ) {
    throw new ApiError('forbidden', 'Cannot check out a tool for another user');
  }

  const expectedReturn = input.expectedReturnAt ? new Date(input.expectedReturnAt) : null;
  const ids = input.toolIds ?? [];
  const skus = [...new Set(input.toolSkus ?? [])];
  if (ids.length === 0 && skus.length === 0) {
    throw new ApiError('validation', 'Provide tool_product_ids or tool_skus');
  }

  return db.transaction(async (tx) => {
    await setAuditContext(tx, {
      userId: principal.profileId,
      impersonatorId: principal.impersonatorId,
    });
    const loanIds: string[] = [];

    const targets: string[] = [...ids];
    if (skus.length) {
      const skuRows = await tx
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.sku, skus));
      const found = new Set(skuRows.map((r) => r.id));
      if (found.size !== skus.length) {
        throw new ApiError('not_found', 'One or more tool SKUs not found');
      }
      targets.push(...skuRows.map((r) => r.id));
    }

    const toolIds = [...new Set(targets)];
    const [productRows, activeRows] = await Promise.all([
      tx
        .select({ id: products.id, item_type: products.itemType })
        .from(products)
        .where(inArray(products.id, toolIds)),
      tx
        .select({ tool_product_id: toolLoans.toolProductId })
        .from(toolLoans)
        .where(and(inArray(toolLoans.toolProductId, toolIds), isNull(toolLoans.returnedAt))),
    ]);

    const productById = new Map(productRows.map((p) => [p.id, p]));
    for (const toolId of toolIds) {
      const product = productById.get(toolId);
      if (!product) throw new ApiError('not_found', `Product ${toolId} not found`);
      if (product.item_type !== 'tool') {
        throw new ApiError('validation', `Product ${toolId} is not a tool`);
      }
    }
    if (activeRows.length > 0) {
      throw new ApiError(
        'conflict',
        `Tool ${activeRows[0].tool_product_id} is already checked out`,
      );
    }

    const inserted = await tx
      .insert(toolLoans)
      .values(
        toolIds.map((toolId) => ({
          toolProductId: toolId,
          workerProfileId: workerId,
          checkedOutByUserId: principal.profileId,
          expectedReturnAt: expectedReturn,
          conditionOnCheckout: input.conditionOnCheckout,
          notes: input.notes ?? null,
        })),
      )
      .returning({ id: toolLoans.id });
    loanIds.push(...inserted.map((l) => l.id));
    return { count: loanIds.length, loan_ids: loanIds };
  });
}

export interface CheckinToolsInput {
  loanIds?: string[];
  toolProductId?: string;
  toolSku?: string;
  conditionOnReturn: string;
}

export async function apiCheckinTools(
  principal: ApiPrincipal,
  input: CheckinToolsInput,
): Promise<{ count: number }> {
  const canAny = can(principal.role, 'tool_loans:return:any');
  const loanIds = [...(input.loanIds ?? [])];

  if (!input.loanIds?.length && (input.toolProductId || input.toolSku)) {
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        input.toolProductId
          ? eq(products.id, input.toolProductId)
          : eq(products.sku, input.toolSku ?? ''),
      )
      .limit(1);
    if (!product) throw new ApiError('not_found', 'Product not found');
    const [active] = await db
      .select({ id: toolLoans.id })
      .from(toolLoans)
      .where(and(eq(toolLoans.toolProductId, product.id), isNull(toolLoans.returnedAt)))
      .limit(1);
    if (!active) throw new ApiError('not_found', 'No active loan for that tool');
    loanIds.push(active.id);
  }
  if (loanIds.length === 0) {
    throw new ApiError('validation', 'Provide loan_ids or a tool identifier');
  }

  return db.transaction(async (tx) => {
    await setAuditContext(tx, {
      userId: principal.profileId,
      impersonatorId: principal.impersonatorId,
    });
    const ids = [...new Set(loanIds)];
    const loans = await tx
      .select({
        id: toolLoans.id,
        worker_profile_id: toolLoans.workerProfileId,
        returned_at: toolLoans.returnedAt,
      })
      .from(toolLoans)
      .where(inArray(toolLoans.id, ids));

    const loanById = new Map(loans.map((l) => [l.id, l]));
    for (const loanId of ids) {
      const loan = loanById.get(loanId);
      if (!loan) throw new ApiError('not_found', `Loan ${loanId} not found`);
      if (loan.returned_at) {
        throw new ApiError('conflict', `Loan ${loanId} already returned`);
      }
      if (!canAny && loan.worker_profile_id !== principal.profileId) {
        throw new ApiError('forbidden', 'Cannot return a loan held by another user');
      }
    }

    await tx
      .update(toolLoans)
      .set({ returnedAt: new Date(), conditionOnReturn: input.conditionOnReturn })
      .where(inArray(toolLoans.id, ids));
    return { count: ids.length };
  });
}

// ============================================================================
// Stock takes
// ============================================================================

export async function apiListTakes(
  principal: ApiPrincipal,
  opts: { limit?: number } = {},
): Promise<StockTakeDTO[]> {
  requirePerm(principal, 'stock_takes:read');
  const rows = await db
    .select({
      id: stockTakes.id,
      started_by: stockTakes.startedBy,
      started_by_name: profiles.fullName,
      status: stockTakes.status,
      started_at: stockTakes.startedAt,
      completed_at: stockTakes.completedAt,
      notes: stockTakes.notes,
      items_total: sql<number>`(
        SELECT count(*) FROM stock_take_items sti
        WHERE sti.stock_take_id = ${stockTakes.id}
      )`,
      items_counted: sql<number>`(
        SELECT count(*) FROM stock_take_items sti
        WHERE sti.stock_take_id = ${stockTakes.id}
        AND sti.physical_qty IS NOT NULL
      )`,
    })
    .from(stockTakes)
    .leftJoin(profiles, eq(stockTakes.startedBy, profiles.id))
    .orderBy(desc(stockTakes.startedAt))
    .limit(clamp(opts.limit ?? 100, 1, 200));

  return rows.map((r) => ({
    ...r,
    started_at: r.started_at?.toISOString() ?? null,
    completed_at: r.completed_at?.toISOString() ?? null,
    items_total: Number(r.items_total),
    items_counted: Number(r.items_counted),
  }));
}

export async function apiGetTakeItems(
  principal: ApiPrincipal,
  stockTakeId: string,
): Promise<StockTakeItemDTO[]> {
  requirePerm(principal, 'stock_takes:read');
  const rows = await db
    .select({
      id: stockTakeItems.id,
      stock_take_id: stockTakeItems.stockTakeId,
      product_id: stockTakeItems.productId,
      system_qty: stockTakeItems.systemQty,
      physical_qty: stockTakeItems.physicalQty,
      variance: stockTakeItems.variance,
      counted_by: stockTakeItems.countedBy,
      counted_at: stockTakeItems.countedAt,
    })
    .from(stockTakeItems)
    .where(eq(stockTakeItems.stockTakeId, stockTakeId));

  return rows.map((r) => ({
    ...r,
    system_qty: Number(r.system_qty),
    physical_qty: r.physical_qty === null ? null : Number(r.physical_qty),
    variance: r.variance === null ? null : Number(r.variance),
    counted_at: r.counted_at?.toISOString() ?? null,
  }));
}

export async function apiStartTake(
  principal: ApiPrincipal,
  opts: { notes?: string | null } = {},
): Promise<{ id: string }> {
  requirePerm(principal, 'stock_takes:write');
  return db.transaction(async (tx) => {
    await setAuditContext(tx, {
      userId: principal.profileId,
      impersonatorId: principal.impersonatorId,
    });
    const [row] = await tx
      .insert(stockTakes)
      .values({ startedBy: principal.profileId, notes: opts.notes ?? null })
      .returning({ id: stockTakes.id });
    return { id: row.id };
  });
}

// ============================================================================
// Bin locations (read-only at this surface)
// ============================================================================

export async function apiListBinLocations(
  principal: ApiPrincipal,
): Promise<BinLocationDTO[]> {
  requirePerm(principal, 'bin_locations:read');
  const rows = await db
    .select({
      id: binLocations.id,
      zone: binLocations.zone,
      bin_location: binLocations.binLocation,
      max_weight_kg: binLocations.maxWeightKg,
      description: binLocations.description,
    })
    .from(binLocations)
    .orderBy(asc(binLocations.zone), asc(binLocations.binLocation))
    .limit(500);
  return rows.map((r) => ({ ...r, max_weight_kg: Number(r.max_weight_kg) }));
}

// ============================================================================
// Storerooms — real table when the 0003_storerooms migration has landed,
// graceful "not yet implemented" otherwise (the MCP tool documents this).
// ============================================================================

export interface StoreroomListResult {
  implemented: boolean;
  message?: string;
  storerooms?: {
    id: string;
    name: string;
    type: string;
    parent_id: string | null;
    access_level: string;
    active: boolean;
  }[];
  bin_locations?: BinLocationDTO[];
}

export async function apiListStorerooms(
  principal: ApiPrincipal,
): Promise<StoreroomListResult> {
  requirePerm(principal, 'bin_locations:read');
  try {
    const { storerooms } = await import('@/drizzle/storerooms-schema');
    const rows = await db
      .select({
        id: storerooms.id,
        name: storerooms.name,
        type: storerooms.type,
        parent_id: storerooms.parentId,
        access_level: storerooms.accessLevel,
        active: storerooms.active,
      })
      .from(storerooms)
      .orderBy(asc(storerooms.name))
      .limit(500);
    return { implemented: true, storerooms: rows };
  } catch {
    // Table not migrated yet — graceful fallback per spec.
    return {
      implemented: false,
      message:
        'Storerooms are not yet implemented in VMS. Bin locations ' +
        '(zone + bin) are the closest existing equivalent and are ' +
        'returned below.',
      bin_locations: await apiListBinLocations(principal),
    };
  }
}

// ============================================================================
// Audit log (admin scope + admin/super_admin role)
// ============================================================================

export async function apiListAudit(
  principal: ApiPrincipal,
  opts: { limit?: number } = {},
): Promise<ActivityLogDTO[]> {
  // Route enforces the 'admin' API scope; here we enforce the role gate —
  // mirroring middleware's ROLE_BASED_ROUTES for /dashboard/audit-log.
  if (principal.role !== 'super_admin' && principal.role !== 'admin') {
    throw new ApiError('forbidden', 'Audit log requires an admin role');
  }
  requirePerm(principal, 'activity_logs:read');

  const rows = await db
    .select({
      id: activityLogs.id,
      user_id: activityLogs.userId,
      user_name: profiles.fullName,
      impersonated_by_name: impersonator.fullName,
      action: activityLogs.actionType,
      table_name: activityLogs.tableName,
      record_id: activityLogs.recordId,
      old_values: activityLogs.oldData,
      new_values: activityLogs.newData,
      ip_address: activityLogs.ipAddress,
      user_agent: activityLogs.userAgent,
      created_at: activityLogs.createdAt,
    })
    .from(activityLogs)
    .leftJoin(profiles, eq(activityLogs.userId, profiles.id))
    .leftJoin(impersonator, eq(activityLogs.impersonatedByUserId, impersonator.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(clamp(opts.limit ?? 100, 1, 500));

  return rows.map((r) => ({
    ...r,
    created_at: r.created_at?.toISOString() ?? null,
  }));
}

// ============================================================================
// Reports (for the MCP run_report tool)
// ============================================================================

export async function apiRunReport(
  principal: ApiPrincipal,
  report: 'stock_summary' | 'low_stock' | 'movements' | 'loans',
  opts: { days?: number } = {},
): Promise<unknown> {
  switch (report) {
    case 'stock_summary': {
      const levels = await apiListStockLevels(principal, { limit: 1000 });
      const byType: Record<string, { count: number; on_hand: number; low: number }> = {};
      for (const l of levels) {
        const bucket = (byType[l.item_type] ??= { count: 0, on_hand: 0, low: 0 });
        bucket.count += 1;
        bucket.on_hand += l.current_stock;
        if (l.low) bucket.low += 1;
      }
      return {
        report,
        generated_at: new Date().toISOString(),
        total_products: levels.length,
        low_stock_products: levels.filter((l) => l.low).length,
        by_item_type: byType,
      };
    }
    case 'low_stock':
      return {
        report,
        generated_at: new Date().toISOString(),
        items: await apiListStockLevels(principal, { onlyLow: true, limit: 500 }),
      };
    case 'movements':
      return {
        report,
        generated_at: new Date().toISOString(),
        days: clamp(opts.days ?? 30, 1, 365),
        scoped_to_own: !can(principal.role, 'stock_movements:read:all'),
        movements: await apiListMovements(principal, {
          days: clamp(opts.days ?? 30, 1, 365),
          limit: 200,
        }),
      };
    case 'loans':
      return {
        report,
        generated_at: new Date().toISOString(),
        scoped_to_own: !can(principal.role, 'tool_loans:read:all'),
        loans: await apiListLoans(principal, { limit: 500 }),
      };
    default:
      throw new ApiError('validation', `Unknown report '${report}'`);
  }
}
