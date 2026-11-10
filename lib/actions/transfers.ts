'use server';

import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  binLocations,
  products,
  productStock,
  profiles,
  stockMovements,
  transferItems,
  transfers,
} from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requireUser, can } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import type {
  BinStockDTO,
  TransferDTO,
  TransferItemDTO,
  TransferStatus,
} from '@/lib/types';

/**
 * Stock transfers — bin→bin / zone→zone movement with chain of custody.
 *
 * A transfer posts PAIRED 'transfer' legs so the product-level ledger stays
 * balanced at every step (roadmap items 21/90/327/353):
 *
 *   draft → dispatch:  −qty @ source bin   +qty @ IN-TRANSIT bin
 *          receive:    −qty @ IN-TRANSIT   +qty @ destination bin
 *          cancel:     −qty @ IN-TRANSIT   +qty @ source bin   (post-dispatch)
 *
 * The product_stock projection is updated by the DB trigger on each leg —
 * stock at a bin is always Σ legs, never a counter written by hand.
 */

const TRANSIT_ZONE = 'In Transit';
const TRANSIT_BIN = 'IN-TRANSIT';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function binLabel(r: {
  zone: string | null;
  bin_location: string | null;
}): string {
  return `${r.zone ?? ''} / ${r.bin_location ?? ''}`.replace(/^ \/ | \/ $/g, '');
}

async function transitBinId(tx: Tx): Promise<string> {
  const [bin] = await tx
    .select({ id: binLocations.id })
    .from(binLocations)
    .where(
      and(
        eq(binLocations.zone, TRANSIT_ZONE),
        eq(binLocations.binLocation, TRANSIT_BIN),
      ),
    )
    .limit(1);
  if (!bin) throw new Error('IN-TRANSIT system bin missing — run migrations');
  return bin.id;
}

/** Insert one signed leg + bump last_movement_date. current_stock never moves
 * on 'transfer' legs — the paired leg in the same transaction carries the
 * counterweight, so Σ stays zero and the ledger invariant holds. */
async function postTransferLegs(
  tx: Tx,
  ctx: { userId: string; impersonatorId: string | null },
  legs: Array<{
    productId: string;
    qty: number;
    binId: string;
    transferItemId: string;
    reason: string;
  }>,
) {
  await tx.insert(stockMovements).values(
    legs.map((l) => ({
      productId: l.productId,
      userId: ctx.userId,
      impersonatedByUserId: ctx.impersonatorId,
      type: 'transfer' as const,
      quantity: String(l.qty),
      reason: l.reason,
      binLocationId: l.binId,
      transferItemId: l.transferItemId,
    })),
  );
  await tx
    .update(products)
    .set({ lastMovementDate: new Date() })
    .where(inArray(products.id, legs.map((l) => l.productId)));
}

const fb = alias(binLocations, 'fb');
const tb = alias(binLocations, 'tb');

export async function listTransfers(limit = 100): Promise<Result<TransferDTO[]>> {
  try {
    const ctx = await requireUser();
    if (!can(ctx.user.role, 'transfers:read')) {
      return fail('Your role cannot view transfers', 'FORBIDDEN');
    }
    const rows = await db
      .select({
        id: transfers.id,
        transfer_number: transfers.transferNumber,
        status: transfers.status,
        from_bin_location_id: transfers.fromBinLocationId,
        to_bin_location_id: transfers.toBinLocationId,
        notes: transfers.notes,
        created_by: transfers.createdBy,
        dispatched_by: transfers.dispatchedBy,
        dispatched_at: transfers.dispatchedAt,
        received_by: transfers.receivedBy,
        received_at: transfers.receivedAt,
        cancelled_at: transfers.cancelledAt,
        cancel_reason: transfers.cancelReason,
        created_at: transfers.createdAt,
        from_zone: fb.zone,
        from_bin: fb.binLocation,
        to_zone: tb.zone,
        to_bin: tb.binLocation,
        created_by_name: profiles.fullName,
        item_count:
          sql<number>`(SELECT count(*)::int FROM transfer_items ti WHERE ti.transfer_id = ${transfers.id})`,
      })
      .from(transfers)
      .leftJoin(fb, eq(transfers.fromBinLocationId, fb.id))
      .leftJoin(tb, eq(transfers.toBinLocationId, tb.id))
      .leftJoin(profiles, eq(transfers.createdBy, profiles.id))
      .orderBy(desc(transfers.createdAt))
      .limit(Math.min(Math.max(limit, 1), 500));

    return ok(
      rows.map((r) => ({
        id: r.id,
        transfer_number: r.transfer_number,
        status: r.status as TransferStatus,
        from_bin_location_id: r.from_bin_location_id,
        from_bin_label: binLabel({ zone: r.from_zone, bin_location: r.from_bin }),
        to_bin_location_id: r.to_bin_location_id,
        to_bin_label: binLabel({ zone: r.to_zone, bin_location: r.to_bin }),
        notes: r.notes,
        created_by: r.created_by,
        created_by_name: r.created_by_name,
        dispatched_by: r.dispatched_by,
        dispatched_by_name: null,
        dispatched_at: r.dispatched_at?.toISOString() ?? null,
        received_by: r.received_by,
        received_by_name: null,
        received_at: r.received_at?.toISOString() ?? null,
        cancelled_at: r.cancelled_at?.toISOString() ?? null,
        cancel_reason: r.cancel_reason,
        item_count: Number(r.item_count),
        created_at: r.created_at?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

export async function getTransferItems(
  transferId: string,
): Promise<Result<TransferItemDTO[]>> {
  try {
    const ctx = await requireUser();
    if (!can(ctx.user.role, 'transfers:read')) {
      return fail('Your role cannot view transfers', 'FORBIDDEN');
    }
    const tid = z.string().uuid().parse(transferId);
    const rows = await db
      .select({
        id: transferItems.id,
        transfer_id: transferItems.transferId,
        product_id: transferItems.productId,
        product_sku: products.sku,
        product_name: products.name,
        product_unit: products.unitOfMeasure,
        quantity: transferItems.quantity,
        dispatched_quantity: transferItems.dispatchedQuantity,
        received_quantity: transferItems.receivedQuantity,
      })
      .from(transferItems)
      .leftJoin(products, eq(transferItems.productId, products.id))
      .where(eq(transferItems.transferId, tid))
      .orderBy(products.sku);
    return ok(
      rows.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        dispatched_quantity: Number(r.dispatched_quantity),
        received_quantity: Number(r.received_quantity),
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

/** Products + quantities currently at a bin — feeds the create form. */
export async function listBinStock(
  binLocationId: string,
): Promise<Result<BinStockDTO[]>> {
  try {
    const ctx = await requireUser();
    if (!can(ctx.user.role, 'transfers:read')) {
      return fail('Your role cannot view bin stock', 'FORBIDDEN');
    }
    const binId = z.string().uuid().parse(binLocationId);
    const rows = await db
      .select({
        product_id: productStock.productId,
        product_sku: products.sku,
        product_name: products.name,
        product_unit: products.unitOfMeasure,
        quantity: productStock.quantity,
      })
      .from(productStock)
      .leftJoin(products, eq(productStock.productId, products.id))
      .where(eq(productStock.binLocationId, binId))
      .orderBy(products.sku);
    return ok(rows.map((r) => ({ ...r, quantity: Number(r.quantity) })));
  } catch (err) {
    return actionError(err);
  }
}

const createSchema = z.object({
  from_bin_location_id: z.string().uuid(),
  to_bin_location_id: z.string().uuid(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().positive('Quantity must be positive'),
      }),
    )
    .min(1, 'Add at least one item'),
});

export async function createTransfer(
  input: unknown,
): Promise<Result<{ transfer_id: string; transfer_number: string }>> {
  try {
    const ctx = await requireUser();
    const data = createSchema.parse(input);
    if (!can(ctx.user.role, 'transfers:create')) {
      return fail('Your role cannot create transfers', 'FORBIDDEN');
    }
    if (data.from_bin_location_id === data.to_bin_location_id) {
      return fail('Source and destination bins must differ', 'VALIDATION');
    }

    const result = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });

      // Validate availability at the source bin — lock the stock rows.
      const productIds = data.items.map((i) => i.product_id);
      const stockRows = await tx
        .select({
          productId: productStock.productId,
          quantity: productStock.quantity,
        })
        .from(productStock)
        .where(
          and(
            eq(productStock.binLocationId, data.from_bin_location_id),
            inArray(productStock.productId, productIds),
          ),
        )
        .for('update');
      const stockByProduct = new Map(
        stockRows.map((r) => [r.productId, Number(r.quantity)]),
      );
      for (const item of data.items) {
        const available = stockByProduct.get(item.product_id) ?? 0;
        if (available < item.quantity) {
          throw new Error(
            `Insufficient stock at source bin (need ${item.quantity}, have ${available})`,
          );
        }
      }

      const [doc] = await tx
        .insert(transfers)
        .values({
          fromBinLocationId: data.from_bin_location_id,
          toBinLocationId: data.to_bin_location_id,
          notes: data.notes || null,
          createdBy: ctx.user.id,
        })
        .returning({ id: transfers.id, transfer_number: transfers.transferNumber });

      await tx.insert(transferItems).values(
        data.items.map((i) => ({
          transferId: doc.id,
          productId: i.product_id,
          quantity: String(i.quantity),
        })),
      );
      return { transfer_id: doc.id, transfer_number: doc.transfer_number };
    });
    return ok(result);
  } catch (err) {
    return actionError(err);
  }
}

export async function dispatchTransfer(
  transferId: string,
): Promise<Result<{ transfer_id: string }>> {
  try {
    const ctx = await requireUser();
    if (!can(ctx.user.role, 'transfers:dispatch')) {
      return fail('Your role cannot dispatch transfers', 'FORBIDDEN');
    }
    const tid = z.string().uuid().parse(transferId);

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const [doc] = await tx
        .select()
        .from(transfers)
        .where(eq(transfers.id, tid))
        .for('update')
        .limit(1);
      if (!doc) throw new Error('Transfer not found');
      if (doc.status !== 'draft') throw new Error('Only draft transfers can be dispatched');

      const items = await tx
        .select()
        .from(transferItems)
        .where(eq(transferItems.transferId, tid));
      if (items.length === 0) throw new Error('Transfer has no items');

      // Re-validate availability at source inside the tx (can't over-draw).
      const stockRows = await tx
        .select({ productId: productStock.productId, quantity: productStock.quantity })
        .from(productStock)
        .where(
          and(
            eq(productStock.binLocationId, doc.fromBinLocationId),
            inArray(productStock.productId, items.map((i) => i.productId)),
          ),
        )
        .for('update');
      const stockByProduct = new Map(stockRows.map((r) => [r.productId, Number(r.quantity)]));
      for (const item of items) {
        if ((stockByProduct.get(item.productId) ?? 0) < Number(item.quantity)) {
          throw new Error(`Insufficient stock at source bin for item ${item.productId}`);
        }
      }

      const transit = await transitBinId(tx);
      await postTransferLegs(tx, { userId: ctx.user.id, impersonatorId: ctx.impersonating ? ctx.actor.id : null },
        items.flatMap((item) => [
          {
            productId: item.productId,
            qty: -Number(item.quantity),
            binId: doc.fromBinLocationId,
            transferItemId: item.id,
            reason: `${doc.transferNumber} dispatch`,
          },
          {
            productId: item.productId,
            qty: Number(item.quantity),
            binId: transit,
            transferItemId: item.id,
            reason: `${doc.transferNumber} in transit`,
          },
        ]),
      );

      await tx
        .update(transferItems)
        .set({ dispatchedQuantity: sql`quantity` })
        .where(eq(transferItems.transferId, tid));
      await tx
        .update(transfers)
        .set({
          status: 'dispatched',
          dispatchedBy: ctx.user.id,
          dispatchedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(transfers.id, tid));
    });
    return ok({ transfer_id: tid });
  } catch (err) {
    return actionError(err);
  }
}

export async function receiveTransfer(
  transferId: string,
): Promise<Result<{ transfer_id: string }>> {
  try {
    const ctx = await requireUser();
    if (!can(ctx.user.role, 'transfers:receive')) {
      return fail('Your role cannot receive transfers', 'FORBIDDEN');
    }
    const tid = z.string().uuid().parse(transferId);

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const [doc] = await tx
        .select()
        .from(transfers)
        .where(eq(transfers.id, tid))
        .for('update')
        .limit(1);
      if (!doc) throw new Error('Transfer not found');
      if (doc.status !== 'dispatched') {
        throw new Error('Only dispatched transfers can be received');
      }
      const items = await tx
        .select()
        .from(transferItems)
        .where(eq(transferItems.transferId, tid));
      const transit = await transitBinId(tx);

      await postTransferLegs(tx, { userId: ctx.user.id, impersonatorId: ctx.impersonating ? ctx.actor.id : null },
        items.flatMap((item) => [
          {
            productId: item.productId,
            qty: -Number(item.dispatchedQuantity),
            binId: transit,
            transferItemId: item.id,
            reason: `${doc.transferNumber} transit out`,
          },
          {
            productId: item.productId,
            qty: Number(item.dispatchedQuantity),
            binId: doc.toBinLocationId,
            transferItemId: item.id,
            reason: `${doc.transferNumber} received`,
          },
        ]),
      );

      await tx
        .update(transferItems)
        .set({ receivedQuantity: sql`dispatched_quantity` })
        .where(eq(transferItems.transferId, tid));
      // Home-bin pointer follows the stock: products whose home was the
      // source bin now live at the destination.
      await tx
        .update(products)
        .set({ binLocationId: doc.toBinLocationId })
        .where(
          and(
            inArray(products.id, items.map((i) => i.productId)),
            eq(products.binLocationId, doc.fromBinLocationId),
          ),
        );
      await tx
        .update(transfers)
        .set({
          status: 'received',
          receivedBy: ctx.user.id,
          receivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(transfers.id, tid));
    });
    return ok({ transfer_id: tid });
  } catch (err) {
    return actionError(err);
  }
}

const cancelSchema = z.object({
  transfer_id: z.string().uuid(),
  reason: z.string().max(1000).optional(),
});

export async function cancelTransfer(
  input: unknown,
): Promise<Result<{ transfer_id: string }>> {
  try {
    const ctx = await requireUser();
    const data = cancelSchema.parse(input);
    if (!can(ctx.user.role, 'transfers:cancel')) {
      return fail('Your role cannot cancel transfers', 'FORBIDDEN');
    }

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const [doc] = await tx
        .select()
        .from(transfers)
        .where(eq(transfers.id, data.transfer_id))
        .for('update')
        .limit(1);
      if (!doc) throw new Error('Transfer not found');
      if (doc.status === 'received' || doc.status === 'cancelled') {
        throw new Error(`Transfer already ${doc.status}`);
      }

      // Dispatched → return the transit stock to the source bin.
      if (doc.status === 'dispatched') {
        const items = await tx
          .select()
          .from(transferItems)
          .where(eq(transferItems.transferId, doc.id));
        const transit = await transitBinId(tx);
        await postTransferLegs(tx, { userId: ctx.user.id, impersonatorId: ctx.impersonating ? ctx.actor.id : null },
          items.flatMap((item) => [
            {
              productId: item.productId,
              qty: -Number(item.dispatchedQuantity),
              binId: transit,
              transferItemId: item.id,
              reason: `${doc.transferNumber} cancel — transit out`,
            },
            {
              productId: item.productId,
              qty: Number(item.dispatchedQuantity),
              binId: doc.fromBinLocationId,
              transferItemId: item.id,
              reason: `${doc.transferNumber} cancel — returned`,
            },
          ]),
        );
      }

      await tx
        .update(transfers)
        .set({
          status: 'cancelled',
          cancelledBy: ctx.user.id,
          cancelledAt: new Date(),
          cancelReason: data.reason || null,
          updatedAt: new Date(),
        })
        .where(eq(transfers.id, doc.id));
    });
    return ok({ transfer_id: data.transfer_id });
  } catch (err) {
    return actionError(err);
  }
}

/** Bulk relocate (roadmap item 327): every product stocked in `from` moves to
 * `to` as a single already-completed transfer — same custody, no transit UX. */
export async function moveAllBinContents(input: {
  from_bin_location_id: string;
  to_bin_location_id: string;
  notes?: string;
}): Promise<Result<{ transfer_id: string | null; moved: number }>> {
  try {
    const ctx = await requireUser();
    if (!can(ctx.user.role, 'transfers:dispatch')) {
      return fail('Your role cannot relocate bins', 'FORBIDDEN');
    }
    const data = createSchema
      .pick({ from_bin_location_id: true, to_bin_location_id: true })
      .extend({ notes: z.string().max(1000).optional() })
      .parse(input);
    if (data.from_bin_location_id === data.to_bin_location_id) {
      return fail('Source and destination bins must differ', 'VALIDATION');
    }

    const result = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const stockRows = await tx
        .select()
        .from(productStock)
        .where(eq(productStock.binLocationId, data.from_bin_location_id))
        .for('update');
      const movable = stockRows.filter((r) => Number(r.quantity) > 0);
      if (movable.length === 0) return { transfer_id: null, moved: 0 };

      const [doc] = await tx
        .insert(transfers)
        .values({
          fromBinLocationId: data.from_bin_location_id,
          toBinLocationId: data.to_bin_location_id,
          notes: data.notes || 'Bulk relocation',
          createdBy: ctx.user.id,
          status: 'draft',
        })
        .returning({ id: transfers.id, transfer_number: transfers.transferNumber });

      const itemRows = await tx
        .insert(transferItems)
        .values(
          movable.map((r) => ({
            transferId: doc.id,
            productId: r.productId,
            quantity: String(r.quantity),
          })),
        )
        .returning({ id: transferItems.id, productId: transferItems.productId, quantity: transferItems.quantity });

      const transit = await transitBinId(tx);
      await postTransferLegs(tx, { userId: ctx.user.id, impersonatorId: ctx.impersonating ? ctx.actor.id : null },
        itemRows.flatMap((item) => [
          { productId: item.productId, qty: -Number(item.quantity), binId: data.from_bin_location_id, transferItemId: item.id, reason: `${doc.transfer_number} relocate out` },
          { productId: item.productId, qty: Number(item.quantity), binId: transit, transferItemId: item.id, reason: `${doc.transfer_number} in transit` },
          { productId: item.productId, qty: -Number(item.quantity), binId: transit, transferItemId: item.id, reason: `${doc.transfer_number} transit out` },
          { productId: item.productId, qty: Number(item.quantity), binId: data.to_bin_location_id, transferItemId: item.id, reason: `${doc.transfer_number} received` },
        ]),
      );

      await tx
        .update(transferItems)
        .set({ dispatchedQuantity: sql`quantity`, receivedQuantity: sql`quantity` })
        .where(eq(transferItems.transferId, doc.id));
      await tx
        .update(products)
        .set({ binLocationId: data.to_bin_location_id })
        .where(
          and(
            inArray(products.id, itemRows.map((i) => i.productId)),
            eq(products.binLocationId, data.from_bin_location_id),
          ),
        );
      await tx
        .update(transfers)
        .set({
          status: 'received',
          dispatchedBy: ctx.user.id,
          dispatchedAt: new Date(),
          receivedBy: ctx.user.id,
          receivedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(transfers.id, doc.id));
      return { transfer_id: doc.id, moved: itemRows.length };
    });
    return ok(result);
  } catch (err) {
    return actionError(err);
  }
}
