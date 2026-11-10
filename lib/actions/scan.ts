'use server';

/**
 * lib/actions/scan — server actions for the scan-first workflow.
 *
 *   submitScan          resolve a scanned code (all input types), always
 *                       writing a scan_events row — including failures.
 *   scanQuickReceive    inbound stock movement (+qty) driven by a scan
 *   scanQuickIssue      outbound stock movement (−qty) driven by a scan
 *   scanToolToggle      check an asset out, or return it if already on loan
 *   scanJoinStockTake   join an open stock take from a `take:` code/label
 *
 * Every write path: requireUser()/permission check → Zod validation → one
 * transaction with setAuditContext (audit triggers write activity_logs) →
 * stock_movements row → scan_events row.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  activityLogs,
  products,
  stockMovements,
  toolLoans,
} from '@/drizzle/schema';
import { SCAN_INPUT_TYPES } from '@/drizzle/scan-schema';
import { setAuditContext } from '@/lib/db/context';
import {
  can,
  requirePermission,
  requireUser,
} from '@/lib/auth/session';
import { canCreateMovement } from '@/lib/auth/permissions';
import { actionError, fail, ok, type Result } from '@/lib/result';
import {
  insertScanEvent,
  lookupTake,
  processScan,
  productSelect,
  toProductDTO,
  type ResolvedEntity,
} from '@/lib/scan/engine';
import { hashScanInput, normalizeScanInput } from '@/lib/scan/codes';
import type { ScanResolutionDTO, ScanWriteResultDTO } from '@/lib/scan/types';

const inputTypeSchema = z.enum(SCAN_INPUT_TYPES);

const scanInputSchema = z.object({
  code: z.string().min(1).max(512),
  input_type: inputTypeSchema,
  device_label: z.string().max(64).nullable().optional(),
  location_context: z.string().max(64).nullable().optional(),
});

/**
 * Resolve a scan. Returns the ScanResolutionDTO even for scan-level
 * failures (unknown code, bad token…) — those are operator-facing states,
 * not action errors. Auth errors still come back as failed Results.
 */
export async function submitScan(input: unknown): Promise<Result<ScanResolutionDTO>> {
  try {
    const ctx = await requireUser();
    const data = scanInputSchema.parse(input);
    const resolution = await processScan(ctx, {
      code: data.code,
      input_type: data.input_type,
      device_label: data.device_label ?? null,
      location_context: data.location_context ?? null,
    });
    return ok(resolution);
  } catch (err) {
    return actionError(err);
  }
}

// ---------------------------------------------------------------------------
// Shared pieces for scan-driven writes
// ---------------------------------------------------------------------------

const writeBaseSchema = z.object({
  /** The exact code that was scanned — hashed into scan_events. */
  code: z.string().min(1).max(512),
  input_type: inputTypeSchema,
  device_label: z.string().max(64).nullable().optional(),
  location_context: z.string().max(64).nullable().optional(),
});

const qtySchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().positive('Quantity must be positive').max(1_000_000),
});

interface Ctx {
  user: { id: string; role: Parameters<typeof can>[0] };
  actor: { id: string };
  impersonating: boolean;
}

function auditActor(ctx: Ctx) {
  return {
    userId: ctx.user.id,
    impersonatorId: ctx.impersonating ? ctx.actor.id : null,
  };
}

interface WriteMeta {
  code: string;
  inputType: (typeof SCAN_INPUT_TYPES)[number];
  deviceLabel: string | null;
  locationContext: string | null;
}

function writeMeta(data: z.infer<typeof writeBaseSchema>): WriteMeta {
  return {
    code: hashScanInput(normalizeScanInput(data.code)),
    inputType: data.input_type,
    deviceLabel: data.device_label ?? null,
    locationContext: data.location_context ?? null,
  };
}

// ---------------------------------------------------------------------------
// Quick receive (+qty → inbound movement)
// ---------------------------------------------------------------------------

export async function scanQuickReceive(input: unknown): Promise<
  Result<ScanWriteResultDTO>
> {
  try {
    const ctx = await requireUser();
    const data = writeBaseSchema.merge(qtySchema).parse(input);
    if (!canCreateMovement(ctx.user.role, 'inbound')) {
      return fail('Your role cannot receive stock', 'FORBIDDEN');
    }
    const meta = writeMeta(data);

    const result = await db.transaction(async (tx) => {
      await setAuditContext(tx, auditActor(ctx));

      const [product] = await tx
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          current_stock: products.currentStock,
          unit_of_measure: products.unitOfMeasure,
        })
        .from(products)
        .where(eq(products.id, data.product_id))
        .for('update')
        .limit(1);
      if (!product) throw new Error('Product not found');

      const newStock = Number(product.current_stock) + Math.abs(data.quantity);

      await tx.insert(stockMovements).values({
        productId: product.id,
        userId: ctx.user.id,
        impersonatedByUserId: ctx.impersonating ? ctx.actor.id : null,
        type: 'inbound',
        quantity: String(Math.abs(data.quantity)),
        reason: 'Scan quick-receive',
      });

      const [updated] = await tx
        .update(products)
        .set({ currentStock: String(newStock), lastMovementDate: new Date() })
        .where(eq(products.id, product.id))
        .returning(productSelect);

      const eventId = await insertScanEvent(tx, {
        userId: ctx.user.id,
        inputType: meta.inputType,
        rawHash: meta.code,
        action: 'receive',
        entityType: updated.item_type === 'tool' ? 'tool' : 'product',
        entityId: product.id,
        deviceLabel: meta.deviceLabel,
        locationContext: meta.locationContext,
      });

      return {
        message: `Received ${data.quantity} ${product.unit_of_measure} of ${product.sku} — now ${newStock}`,
        scan_event_id: eventId,
        product: toProductDTO(updated),
      };
    });

    return ok(result);
  } catch (err) {
    return actionError(err);
  }
}

// ---------------------------------------------------------------------------
// Quick issue (−qty → outbound movement)
// ---------------------------------------------------------------------------

export async function scanQuickIssue(input: unknown): Promise<
  Result<ScanWriteResultDTO>
> {
  try {
    const ctx = await requireUser();
    const data = writeBaseSchema.merge(qtySchema).parse(input);
    if (!canCreateMovement(ctx.user.role, 'outbound')) {
      return fail('Your role cannot issue stock', 'FORBIDDEN');
    }
    const meta = writeMeta(data);

    const result = await db.transaction(async (tx) => {
      await setAuditContext(tx, auditActor(ctx));

      const [product] = await tx
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          current_stock: products.currentStock,
          unit_of_measure: products.unitOfMeasure,
        })
        .from(products)
        .where(eq(products.id, data.product_id))
        .for('update')
        .limit(1);
      if (!product) throw new Error('Product not found');

      const newStock = Number(product.current_stock) - Math.abs(data.quantity);
      if (newStock < 0) throw new Error('Insufficient stock');

      await tx.insert(stockMovements).values({
        productId: product.id,
        userId: ctx.user.id,
        impersonatedByUserId: ctx.impersonating ? ctx.actor.id : null,
        type: 'outbound',
        quantity: String(-Math.abs(data.quantity)),
        reason: 'Scan quick-issue',
      });

      const [updated] = await tx
        .update(products)
        .set({ currentStock: String(newStock), lastMovementDate: new Date() })
        .where(eq(products.id, product.id))
        .returning(productSelect);

      const eventId = await insertScanEvent(tx, {
        userId: ctx.user.id,
        inputType: meta.inputType,
        rawHash: meta.code,
        action: 'issue',
        entityType: updated.item_type === 'tool' ? 'tool' : 'product',
        entityId: product.id,
        deviceLabel: meta.deviceLabel,
        locationContext: meta.locationContext,
      });

      return {
        message: `Issued ${data.quantity} ${product.unit_of_measure} of ${product.sku} — now ${newStock}`,
        scan_event_id: eventId,
        product: toProductDTO(updated),
      };
    });

    return ok(result);
  } catch (err) {
    return actionError(err);
  }
}

// ---------------------------------------------------------------------------
// Tool check-out / check-in toggle
// ---------------------------------------------------------------------------

const toolSchema = writeBaseSchema.extend({
  product_id: z.string().uuid(),
  condition: z.string().trim().min(1).max(100).optional(),
});

/**
 * One scan either checks the tool out to the current user (no active loan)
 * or returns it (active loan, permitted). Mirrors check_out_tool /
 * return_tool (007) — tool_loans rows only — plus a tool_checkout
 * stock_movements row (−1 checkout / +1 return, linked via tool_loan_id)
 * as the custody audit trail the scan spec requires.
 *
 * Deliberately does NOT change products.current_stock: in this schema tool
 * stock counts owned units and custody lives on tool_loans (the tool-loans
 * page path takes the same view). Changing stock here while the loans page
 * doesn't would let mixed paths corrupt the count.
 * The movement insert is a system record of the loan — the movement-type
 * matrix intentionally gates user-recorded movements, not loan writes.
 */
export async function scanToolToggle(input: unknown): Promise<
  Result<ScanWriteResultDTO>
> {
  try {
    const ctx = await requirePermission('tool_loans:create');
    const data = toolSchema.parse(input);
    const meta = writeMeta(data);
    const condition = data.condition ?? 'Good';

    const result = await db.transaction(async (tx) => {
      await setAuditContext(tx, auditActor(ctx));

      const [product] = await tx
        .select({
          id: products.id,
          sku: products.sku,
          name: products.name,
          item_type: products.itemType,
          current_stock: products.currentStock,
          unit_of_measure: products.unitOfMeasure,
        })
        .from(products)
        .where(eq(products.id, data.product_id))
        .for('update')
        .limit(1);
      if (!product) throw new Error('Product not found');
      if (product.item_type !== 'tool') throw new Error('Product is not a tool');

      const [active] = await tx
        .select({
          id: toolLoans.id,
          worker_profile_id: toolLoans.workerProfileId,
        })
        .from(toolLoans)
        .where(
          and(
            eq(toolLoans.toolProductId, product.id),
            isNull(toolLoans.returnedAt),
          ),
        )
        .orderBy(desc(toolLoans.checkedOutAt))
        .limit(1);

      let message: string;
      let entityLoan: ResolvedEntity['activeLoan'] = null;
      let action: string;
      let loanId: string | null = null;

      if (active) {
        // ---- return path ---------------------------------------------------
        const canAny = can(ctx.user.role, 'tool_loans:return:any');
        if (!canAny && active.worker_profile_id !== ctx.user.id) {
          throw new Error('Cannot return a loan held by another user');
        }
        await tx
          .update(toolLoans)
          .set({ returnedAt: new Date(), conditionOnReturn: condition })
          .where(eq(toolLoans.id, active.id));
        action = 'tool_return';
        loanId = active.id;
        message = `Returned ${product.sku} (${product.name})`;
      } else {
        // ---- checkout path -------------------------------------------------
        const [loan] = await tx
          .insert(toolLoans)
          .values({
            toolProductId: product.id,
            workerProfileId: ctx.user.id,
            checkedOutByUserId: ctx.user.id,
            conditionOnCheckout: condition,
          })
          .returning({ id: toolLoans.id });
        action = 'tool_checkout';
        loanId = loan.id;
        entityLoan = {
          loan_id: loan.id,
          worker_profile_id: ctx.user.id,
          worker_name: ctx.user.fullName,
          checked_out_at: new Date().toISOString(),
        };
        message = `Checked out ${product.sku} (${product.name})`;
      }

      await tx.insert(stockMovements).values({
        productId: product.id,
        userId: ctx.user.id,
        impersonatedByUserId: ctx.impersonating ? ctx.actor.id : null,
        type: 'tool_checkout',
        quantity: String(action === 'tool_checkout' ? -1 : 1),
        reason: action === 'tool_checkout' ? 'Scan tool check-out' : 'Scan tool return',
        toolLoanId: loanId,
      });

      const [updated] = await tx
        .select(productSelect)
        .from(products)
        .where(eq(products.id, product.id))
        .limit(1);

      const eventId = await insertScanEvent(tx, {
        userId: ctx.user.id,
        inputType: meta.inputType,
        rawHash: meta.code,
        action,
        entityType: 'tool',
        entityId: product.id,
        deviceLabel: meta.deviceLabel,
        locationContext: meta.locationContext,
      });

      return {
        message,
        scan_event_id: eventId,
        product: updated ? toProductDTO(updated) : null,
        active_loan: entityLoan,
      };
    });

    return ok(result);
  } catch (err) {
    return actionError(err);
  }
}

// ---------------------------------------------------------------------------
// Join an open stock take
// ---------------------------------------------------------------------------

const joinSchema = writeBaseSchema.extend({
  stock_take_id: z.string().uuid(),
});

/**
 * Join an open stock take reached via a `take:` code or label. Returns the
 * take DTO — counting happens on the stock-takes screen via the shared
 * saveStockTakeCounts/completeStockTake actions.
 */
export async function scanJoinStockTake(input: unknown): Promise<
  Result<ScanWriteResultDTO>
> {
  try {
    const ctx = await requirePermission('stock_takes:write');
    const data = joinSchema.parse(input);
    const meta = writeMeta(data);

    const result = await db.transaction(async (tx) => {
      await setAuditContext(tx, auditActor(ctx));

      const resolved = await lookupTake(tx, data.stock_take_id);
      if (!resolved?.stockTake) throw new Error('Stock take not found');
      if (resolved.stockTake.status !== 'open') {
        throw new Error('Stock take is not open');
      }

      const eventId = await insertScanEvent(tx, {
        userId: ctx.user.id,
        inputType: meta.inputType,
        rawHash: meta.code,
        action: 'join_take',
        entityType: 'take',
        entityId: data.stock_take_id,
        deviceLabel: meta.deviceLabel,
        locationContext: meta.locationContext,
      });

      // Joining writes no trigger-audited table — log it explicitly.
      await tx.insert(activityLogs).values({
        userId: ctx.user.id,
        impersonatedByUserId: ctx.impersonating ? ctx.actor.id : null,
        actionType: 'JOIN_STOCK_TAKE',
        tableName: 'stock_takes',
        recordId: data.stock_take_id,
        newData: { source: 'scan', location: meta.locationContext },
      });

      return {
        message: `Joined stock take ${data.stock_take_id.slice(0, 8)}`,
        scan_event_id: eventId,
        stock_take: resolved.stockTake,
      };
    });

    return ok(result);
  } catch (err) {
    return actionError(err);
  }
}

