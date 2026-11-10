/**
 * lib/scan/engine — scan resolution pipeline, shared by the server action
 * (lib/actions/scan.ts) and the REST boundary (/api/scan/route.ts).
 *
 * Pipeline: normalize → hash → (manual) rate-limit → classify
 * (label token | typed code | bare code) → verify/resolve → anomaly check
 * → insert scan_events row → build role-aware resolution DTO.
 *
 * Every attempt — including failures — lands in scan_events. Anomalies are
 * FLAGGED, not silently rejected, so the audit trail shows the suspicious
 * scan alongside its flag_reason.
 */

import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  binLocations,
  products,
  profiles,
  stockTakes,
  toolLoans,
} from '@/drizzle/schema';
import {
  scanEvents,
  labelTokens,
  type ScanInputType,
  type ScanEntityType,
} from '@/drizzle/scan-schema';
import { setAuditContext, type Tx } from '@/lib/db/context';
import { can, type CurrentAuth } from '@/lib/auth/session';
import { canCreateMovement } from '@/lib/auth/permissions';
import {
  hashScanInput,
  isLabelToken,
  isUuid,
  normalizeScanInput,
  parseTypedCode,
} from './codes';
import { tokenHash, verifyLabelToken } from './tokens';
import { allowManualScan } from './rate-limit';
import type {
  ActiveLoanInfo,
  ScanAction,
  ScanEntityRef,
  ScanResolutionDTO,
} from './types';
import type { BinLocationDTO, ProductDTO, StockTakeDTO } from '@/lib/types';

/** Same entity scanned at two different locations inside this window. */
const IMPOSSIBLE_VELOCITY_SECONDS = 60;

export interface ProcessScanInput {
  code: string;
  input_type: ScanInputType;
  device_label?: string | null;
  location_context?: string | null;
}

// ---------------------------------------------------------------------------
// Row → DTO helpers (numeric columns arrive as strings via postgres.js)
// ---------------------------------------------------------------------------

export const productSelect = {
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

interface ProductRow {
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
}

export function toProductDTO(r: ProductRow): ProductDTO {
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
  };
}

const binSelect = {
  id: binLocations.id,
  zone: binLocations.zone,
  bin_location: binLocations.binLocation,
  max_weight_kg: binLocations.maxWeightKg,
  description: binLocations.description,
} as const;

function toBinDTO(r: {
  id: string;
  zone: string;
  bin_location: string;
  max_weight_kg: string;
  description: string | null;
}): BinLocationDTO {
  return {
    id: r.id,
    zone: r.zone,
    bin_location: r.bin_location,
    max_weight_kg: Number(r.max_weight_kg),
    description: r.description,
  };
}

// ---------------------------------------------------------------------------
// scan_events insert
// ---------------------------------------------------------------------------

export interface ScanEventInsert {
  userId: string;
  inputType: ScanInputType;
  rawHash: string;
  action: string;
  entityType?: ScanEntityType | null;
  entityId?: string | null;
  deviceLabel?: string | null;
  locationContext?: string | null;
  flagged?: boolean;
  flagReason?: string | null;
}

/** Insert one scan_events row inside `tx`; returns its id. */
export async function insertScanEvent(
  tx: Tx,
  e: ScanEventInsert,
): Promise<string> {
  const [row] = await tx
    .insert(scanEvents)
    .values({
      userId: e.userId,
      deviceLabel: e.deviceLabel ?? null,
      inputType: e.inputType,
      rawHash: e.rawHash,
      resolvedEntityType: e.entityType ?? null,
      resolvedEntityId: e.entityId ?? null,
      action: e.action,
      locationContext: e.locationContext ?? null,
      flagged: e.flagged ?? false,
      flagReason: e.flagReason ?? null,
    })
    .returning({ id: scanEvents.id });
  return row.id;
}

// ---------------------------------------------------------------------------
// Entity lookups (run inside the caller's transaction for snapshot consistency)
// ---------------------------------------------------------------------------

export interface ResolvedEntity {
  entity: ScanEntityRef;
  product?: ProductDTO | null;
  productBin?: BinLocationDTO | null;
  activeLoan?: ActiveLoanInfo | null;
  binLocation?: BinLocationDTO | null;
  stockTake?: StockTakeDTO | null;
}

export async function lookupProduct(
  tx: Tx,
  key: string,
): Promise<ResolvedEntity | null> {
  const where: SQL | undefined = isUuid(key)
    ? eq(products.id, key)
    : sql`lower(${products.sku}) = ${key.toLowerCase()}`;
  const [row] = await tx.select(productSelect).from(products).where(where).limit(1);
  if (!row) return null;
  const product = toProductDTO(row);

  let productBin: BinLocationDTO | null = null;
  if (row.bin_location_id) {
    const [b] = await tx
      .select(binSelect)
      .from(binLocations)
      .where(eq(binLocations.id, row.bin_location_id))
      .limit(1);
    productBin = b ? toBinDTO(b) : null;
  }

  let activeLoan: ActiveLoanInfo | null = null;
  let entityType: ScanEntityType = 'product';
  if (product.item_type === 'tool') {
    entityType = 'tool';
    const [loan] = await tx
      .select({
        loan_id: toolLoans.id,
        worker_profile_id: toolLoans.workerProfileId,
        worker_name: profiles.fullName,
        checked_out_at: toolLoans.checkedOutAt,
      })
      .from(toolLoans)
      .leftJoin(profiles, eq(toolLoans.workerProfileId, profiles.id))
      .where(
        and(eq(toolLoans.toolProductId, product.id), isNull(toolLoans.returnedAt)),
      )
      .orderBy(desc(toolLoans.checkedOutAt))
      .limit(1);
    activeLoan = loan
      ? { ...loan, checked_out_at: loan.checked_out_at?.toISOString() ?? null }
      : null;
  }

  return {
    entity: {
      type: entityType,
      id: product.id,
      label: product.sku,
      detail: product.name,
    },
    product,
    productBin,
    activeLoan,
  };
}

async function lookupBin(tx: Tx, key: string): Promise<ResolvedEntity | null> {
  const keyLower = key.toLowerCase();
  const textConds = or(
    sql`lower(${binLocations.zone} || '-' || ${binLocations.binLocation}) = ${keyLower}`,
    sql`lower(${binLocations.zone} || ':' || ${binLocations.binLocation}) = ${keyLower}`,
    sql`lower(${binLocations.binLocation}) = ${keyLower}`,
  );
  const where = isUuid(key)
    ? or(textConds, eq(binLocations.id, key))
    : textConds;
  const [row] = await tx.select(binSelect).from(binLocations).where(where).limit(1);
  if (!row) return null;
  const bin = toBinDTO(row);
  return {
    entity: {
      type: 'bin',
      id: bin.id,
      label: `${bin.zone}-${bin.bin_location}`,
      detail: bin.description,
    },
    binLocation: bin,
  };
}

export async function lookupTake(tx: Tx, key: string): Promise<ResolvedEntity | null> {
  if (!isUuid(key)) return null;
  const [row] = await tx
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
    .where(eq(stockTakes.id, key))
    .limit(1);
  if (!row) return null;
  const take: StockTakeDTO = {
    ...row,
    started_at: row.started_at?.toISOString() ?? null,
    completed_at: row.completed_at?.toISOString() ?? null,
    items_total: Number(row.items_total),
    items_counted: Number(row.items_counted),
  };
  return {
    entity: {
      type: 'take',
      id: take.id,
      label: `Stock take ${take.id.slice(0, 8)}`,
      detail:
        take.status === 'open'
          ? `Open — ${take.items_counted}/${take.items_total} counted`
          : 'Completed',
    },
    stockTake: take,
  };
}

async function resolveByType(
  tx: Tx,
  type: ScanEntityType,
  key: string,
): Promise<ResolvedEntity | null> {
  switch (type) {
    case 'product':
    case 'tool':
      return lookupProduct(tx, key);
    case 'bin':
      return lookupBin(tx, key);
    case 'take':
      return lookupTake(tx, key);
  }
}

// ---------------------------------------------------------------------------
// Role-aware allowed actions (mirrors the permission matrix — the server
// actions re-enforce each one on write; this list only shapes the UI).
// ---------------------------------------------------------------------------

function allowedActions(
  ctx: CurrentAuth,
  resolved: ResolvedEntity | null,
): ScanAction[] {
  if (!resolved) {
    return can(ctx.user.role, 'products:write') ? ['create_product'] : [];
  }
  const { entity } = resolved;
  switch (entity.type) {
    case 'product': {
      const acts: ScanAction[] = ['view'];
      if (canCreateMovement(ctx.user.role, 'inbound')) acts.push('receive');
      if (canCreateMovement(ctx.user.role, 'outbound')) acts.push('issue');
      return acts;
    }
    case 'tool': {
      const acts: ScanAction[] = ['view'];
      const loan = resolved.activeLoan ?? null;
      const mayCheckout = !loan && can(ctx.user.role, 'tool_loans:create');
      const mayReturn =
        loan !== null &&
        (can(ctx.user.role, 'tool_loans:return:any') ||
          loan.worker_profile_id === ctx.user.id);
      if (mayCheckout || mayReturn) acts.push('tool_toggle');
      if (canCreateMovement(ctx.user.role, 'inbound')) acts.push('receive');
      if (canCreateMovement(ctx.user.role, 'outbound')) acts.push('issue');
      return acts;
    }
    case 'bin':
      return ['set_location'];
    case 'take': {
      const acts: ScanAction[] = ['view'];
      if (
        resolved.stockTake?.status === 'open' &&
        can(ctx.user.role, 'stock_takes:write')
      ) {
        acts.push('join_take');
      }
      return acts;
    }
  }
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------

interface FinishOptions {
  ok: boolean;
  error?: string | null;
  flagReason?: string | null;
  resolved?: ResolvedEntity | null;
  suggestedSku?: string | null;
}

export async function processScan(
  ctx: CurrentAuth,
  input: ProcessScanInput,
): Promise<ScanResolutionDTO> {
  const normalized = normalizeScanInput(input.code);
  const rawHash = hashScanInput(normalized);
  const locationContext = input.location_context?.trim() || null;
  const deviceLabel = input.device_label?.trim() || null;
  const manualLogged = input.input_type === 'manual';

  /**
   * Write the scan_events row + anomaly check in one short transaction and
   * assemble the response DTO.
   */
  const finish = async (opts: FinishOptions): Promise<ScanResolutionDTO> => {
    const resolved = opts.resolved ?? null;

    return db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });

      let flagReason = opts.flagReason ?? null;
      if (resolved && opts.ok && locationContext) {
        // Impossible velocity: the same entity resolved at a DIFFERENT
        // location <60s ago → flag the row, still resolve. Flag-not-block
        // keeps the line moving while leaving an anomaly trail.
        const since = new Date(Date.now() - IMPOSSIBLE_VELOCITY_SECONDS * 1000);
        const [prev] = await tx
          .select({ createdAt: scanEvents.createdAt })
          .from(scanEvents)
          .where(
            and(
              eq(scanEvents.resolvedEntityType, resolved.entity.type),
              eq(scanEvents.resolvedEntityId, resolved.entity.id),
              sql`${scanEvents.locationContext} IS NOT NULL`,
              sql`${scanEvents.locationContext} <> ${locationContext}`,
              sql`${scanEvents.createdAt} >= ${since}`,
            ),
          )
          .orderBy(desc(scanEvents.createdAt))
          .limit(1);
        if (prev) flagReason = flagReason ?? 'impossible_velocity';
      }

      const eventId = await insertScanEvent(tx, {
        userId: ctx.user.id,
        inputType: input.input_type,
        rawHash,
        action: 'resolve',
        entityType: resolved?.entity.type ?? null,
        entityId: resolved?.entity.id ?? null,
        deviceLabel,
        locationContext,
        flagged: flagReason !== null,
        flagReason,
      });

      return {
        ok: opts.ok,
        error: opts.error ?? null,
        code: normalized,
        input_type: input.input_type,
        manual_logged: manualLogged,
        scan_event_id: eventId,
        entity: opts.ok ? resolved?.entity ?? null : null,
        allowed_actions: opts.ok ? allowedActions(ctx, resolved) : [],
        flag_reason: flagReason,
        product: resolved?.product ?? null,
        product_bin: resolved?.productBin ?? null,
        active_loan: resolved?.activeLoan ?? null,
        bin_location: resolved?.binLocation ?? null,
        stock_take: resolved?.stockTake ?? null,
        suggested_sku: opts.suggestedSku ?? null,
      };
    });
  };

  // ---- 0. sanity ----------------------------------------------------------
  if (!normalized) {
    return finish({ ok: false, error: 'Empty scan', flagReason: 'empty_input' });
  }

  // ---- 1. manual-entry rate limit -----------------------------------------
  if (manualLogged && !allowManualScan(ctx.user.id)) {
    return finish({
      ok: false,
      error: 'Manual entry rate limit exceeded (30/min)',
      flagReason: 'rate_limited',
    });
  }

  // ---- 2. classify + resolve ----------------------------------------------
  let resolved: ResolvedEntity | null = null;
  let failure: { error: string; flagReason: string } | null = null;

  try {
    await db.transaction(async (tx) => {
      if (isLabelToken(normalized)) {
        // Signed label token: signature + expiry, then the nonce cache —
        // the token must be one WE issued and not consumed/rotated.
        const v = verifyLabelToken(normalized);
        if (!v.ok) {
          failure = {
            error:
              v.reason === 'expired'
                ? 'Label token expired'
                : v.reason === 'bad_signature'
                  ? 'Invalid label signature'
                  : 'Malformed label token',
            flagReason: `token_${v.reason}`,
          };
          return;
        }
        const [issued] = await tx
          .select({ consumedAt: labelTokens.consumedAt })
          .from(labelTokens)
          .where(eq(labelTokens.tokenHash, tokenHash(normalized)))
          .limit(1);
        if (!issued) {
          failure = { error: 'Unknown label token', flagReason: 'token_unknown' };
          return;
        }
        if (issued.consumedAt) {
          failure = {
            error: 'Label has been rotated — print a fresh label',
            flagReason: 'token_consumed',
          };
          return;
        }
        resolved = await resolveByType(tx, v.type, v.id);
        if (!resolved) {
          failure = {
            error: 'Label points at a deleted entity',
            flagReason: 'entity_missing',
          };
        }
        return;
      }

      const typed = parseTypedCode(normalized);
      if (typed) {
        if (!typed.checkOk) {
          failure = { error: 'Bad code checksum', flagReason: 'bad_checksum' };
          return;
        }
        resolved = await resolveByType(tx, typed.entityType!, typed.id);
        return;
      }

      // Bare code fallback: product SKU → bin code → stock take uuid.
      resolved =
        (await lookupProduct(tx, normalized)) ??
        (await lookupBin(tx, normalized)) ??
        (await lookupTake(tx, normalized));
    });
  } catch {
    failure = { error: 'Lookup failed', flagReason: 'lookup_error' };
    resolved = null;
  }

  if (failure) {
    const f = failure as { error: string; flagReason: string };
    return finish({ ok: false, error: f.error, flagReason: f.flagReason });
  }
  if (!resolved) {
    // Unknown code → suggest a create-product prefill SKU.
    return finish({ ok: true, suggestedSku: normalized, error: 'Unrecognized code' });
  }
  return finish({ ok: true, resolved });
}
