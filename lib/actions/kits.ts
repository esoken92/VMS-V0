'use server';

import { asc, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  productComponents,
  products,
  stockMovements,
} from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requireUser, can } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import type { KitComponentDTO, KitDTO } from '@/lib/types';

/**
 * Kits / bundles — a kit is a product with a BOM in product_components
 * (roadmap items 321/345). Assemble posts 'kit_consume' legs on components
 * and a 'kit_produce' leg on the kit in ONE transaction — either the whole
 * assembly posts or nothing does, so components can't silently vanish.
 * Quantities move at product level; the legs also carry each product's home
 * bin so the per-bin projection stays truthful.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Post a leg that DOES move products.current_stock (unlike 'transfer' legs —
 * kit assembly genuinely changes what exists: components consumed, kit made). */
async function postKitLeg(
  tx: Tx,
  ctx: { userId: string; impersonatorId: string | null },
  leg: {
    productId: string;
    type: 'kit_consume' | 'kit_produce';
    signedQty: number;
    reason: string;
  },
) {
  const [product] = await tx
    .select({
      id: products.id,
      current_stock: products.currentStock,
      bin_location_id: products.binLocationId,
    })
    .from(products)
    .where(eq(products.id, leg.productId))
    .for('update')
    .limit(1);
  if (!product) throw new Error('Product not found');

  const newStock = Number(product.current_stock) + leg.signedQty;
  if (newStock < 0) throw new Error('Insufficient component stock');

  await tx.insert(stockMovements).values({
    productId: leg.productId,
    userId: ctx.userId,
    impersonatedByUserId: ctx.impersonatorId,
    type: leg.type,
    quantity: String(leg.signedQty),
    reason: leg.reason,
    binLocationId: product.bin_location_id,
  });
  await tx
    .update(products)
    .set({ currentStock: String(newStock), lastMovementDate: new Date() })
    .where(eq(products.id, leg.productId));
}

const comp = alias(products, 'comp');

export async function listKits(): Promise<Result<KitDTO[]>> {
  try {
    const ctx = await requireUser();
    if (!can(ctx.user.role, 'kits:read')) {
      return fail('Your role cannot view kits', 'FORBIDDEN');
    }
    const rows = await db
      .select({
        product_id: productComponents.kitProductId,
        product_sku: products.sku,
        product_name: products.name,
        product_unit: products.unitOfMeasure,
        current_stock: products.currentStock,
        component_count: sql<number>`count(*)::int`,
        buildable: sql<number>`floor(min(${comp.currentStock} / ${productComponents.quantity}))::int`,
      })
      .from(productComponents)
      .leftJoin(products, eq(productComponents.kitProductId, products.id))
      .leftJoin(comp, eq(productComponents.componentProductId, comp.id))
      .groupBy(
        productComponents.kitProductId,
        products.id,
        products.sku,
        products.name,
        products.unitOfMeasure,
        products.currentStock,
      )
      .orderBy(asc(products.sku));
    return ok(
      rows.map((r) => ({
        ...r,
        current_stock: Number(r.current_stock),
        component_count: Number(r.component_count),
        buildable: Number(r.buildable ?? 0),
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

export async function getKitComponents(
  kitProductId: string,
): Promise<Result<KitComponentDTO[]>> {
  try {
    const ctx = await requireUser();
    if (!can(ctx.user.role, 'kits:read')) {
      return fail('Your role cannot view kits', 'FORBIDDEN');
    }
    const kitId = z.string().uuid().parse(kitProductId);
    const rows = await db
      .select({
        component_product_id: productComponents.componentProductId,
        product_sku: products.sku,
        product_name: products.name,
        product_unit: products.unitOfMeasure,
        quantity: productComponents.quantity,
        component_stock: products.currentStock,
      })
      .from(productComponents)
      .leftJoin(products, eq(productComponents.componentProductId, products.id))
      .where(eq(productComponents.kitProductId, kitId))
      .orderBy(asc(products.sku));
    return ok(
      rows.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        component_stock: Number(r.component_stock),
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

const bomSchema = z.object({
  kit_product_id: z.string().uuid(),
  components: z.array(
    z.object({
      component_product_id: z.string().uuid(),
      quantity: z.number().positive('Quantity must be positive'),
    }),
  ),
});

/** Replace a kit's BOM. Empty components list = the product stops being a kit. */
export async function setKitComponents(
  input: unknown,
): Promise<Result<{ kit_product_id: string }>> {
  try {
    const ctx = await requireUser();
    const data = bomSchema.parse(input);
    if (!can(ctx.user.role, 'kits:write')) {
      return fail('Your role cannot edit kit contents', 'FORBIDDEN');
    }
    if (data.components.some((c) => c.component_product_id === data.kit_product_id)) {
      return fail('A kit cannot contain itself', 'VALIDATION');
    }
    const kitIsComponentElsewhere = await db
      .select({ kit: productComponents.kitProductId })
      .from(productComponents)
      .where(eq(productComponents.componentProductId, data.kit_product_id))
      .limit(1);
    if (kitIsComponentElsewhere.length > 0) {
      return fail('This product is a component of another kit — nested kits are not supported', 'VALIDATION');
    }

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      // Components that are kits themselves would nest — reject.
      if (data.components.length > 0) {
        const nested = await tx
          .select({ kit: productComponents.kitProductId })
          .from(productComponents)
          .where(
            inArray(
              productComponents.kitProductId,
              data.components.map((c) => c.component_product_id),
            ),
          )
          .limit(1);
        if (nested.length > 0) {
          throw new Error('A component cannot be a kit — nested kits are not supported');
        }
      }
      await tx
        .delete(productComponents)
        .where(eq(productComponents.kitProductId, data.kit_product_id));
      if (data.components.length > 0) {
        await tx.insert(productComponents).values(
          data.components.map((c) => ({
            kitProductId: data.kit_product_id,
            componentProductId: c.component_product_id,
            quantity: String(c.quantity),
          })),
        );
      }
    });
    return ok({ kit_product_id: data.kit_product_id });
  } catch (err) {
    return actionError(err);
  }
}

const assembleSchema = z.object({
  kit_product_id: z.string().uuid(),
  quantity: z.number().positive('Quantity must be positive'),
  reason: z.string().max(1000).optional(),
});

/** Build `qty` kits: components −(qty×bom) each, kit +qty — one transaction. */
export async function assembleKit(
  input: unknown,
): Promise<Result<{ built: number }>> {
  try {
    const ctx = await requireUser();
    const data = assembleSchema.parse(input);
    if (!can(ctx.user.role, 'kits:assemble')) {
      return fail('Your role cannot assemble kits', 'FORBIDDEN');
    }

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const bom = await tx
        .select({
          componentId: productComponents.componentProductId,
          quantity: productComponents.quantity,
          sku: products.sku,
        })
        .from(productComponents)
        .leftJoin(products, eq(productComponents.componentProductId, products.id))
        .where(eq(productComponents.kitProductId, data.kit_product_id));
      if (bom.length === 0) throw new Error('This product has no kit contents defined');

      const leg = { userId: ctx.user.id, impersonatorId: ctx.impersonating ? ctx.actor.id : null };
      const reason = data.reason || 'Kit assembly';
      for (const c of bom) {
        await postKitLeg(tx, leg, {
          productId: c.componentId,
          type: 'kit_consume',
          signedQty: -data.quantity * Number(c.quantity),
          reason: `${reason} — consumed by kit`,
        });
      }
      await postKitLeg(tx, leg, {
        productId: data.kit_product_id,
        type: 'kit_produce',
        signedQty: data.quantity,
        reason,
      });
    });
    return ok({ built: data.quantity });
  } catch (err) {
    return actionError(err);
  }
}

/** Break `qty` kits back into components — the mirror of assembleKit. */
export async function disassembleKit(
  input: unknown,
): Promise<Result<{ broken: number }>> {
  try {
    const ctx = await requireUser();
    const data = assembleSchema.parse(input);
    if (!can(ctx.user.role, 'kits:assemble')) {
      return fail('Your role cannot disassemble kits', 'FORBIDDEN');
    }

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const bom = await tx
        .select({
          componentId: productComponents.componentProductId,
          quantity: productComponents.quantity,
        })
        .from(productComponents)
        .where(eq(productComponents.kitProductId, data.kit_product_id));
      if (bom.length === 0) throw new Error('This product has no kit contents defined');

      const leg = { userId: ctx.user.id, impersonatorId: ctx.impersonating ? ctx.actor.id : null };
      const reason = data.reason || 'Kit disassembly';
      await postKitLeg(tx, leg, {
        productId: data.kit_product_id,
        type: 'kit_consume',
        signedQty: -data.quantity,
        reason,
      });
      for (const c of bom) {
        await postKitLeg(tx, leg, {
          productId: c.componentId,
          type: 'kit_produce',
          signedQty: data.quantity * Number(c.quantity),
          reason: `${reason} — returned to stock`,
        });
      }
    });
    return ok({ broken: data.quantity });
  } catch (err) {
    return actionError(err);
  }
}
