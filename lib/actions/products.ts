'use server';

import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { products } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requirePermission } from '@/lib/auth/session';
import { actionError, ok, type Result } from '@/lib/result';
import { ITEM_TYPES } from '@/lib/auth/roles';
import type { ProductDTO } from '@/lib/types';

const productSelect = {
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

function toDTO(r: ProductRow): ProductDTO {
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

export async function listProducts(): Promise<Result<ProductDTO[]>> {
  try {
    await requirePermission('products:read');
    const rows = await db
      .select(productSelect)
      .from(products)
      .orderBy(asc(products.sku));
    return ok(rows.map(toDTO));
  } catch (err) {
    return actionError(err);
  }
}

/** Lightweight option list for dropdowns (tools page filters item_type). */
export async function listToolProducts(): Promise<
  Result<{ id: string; sku: string; name: string; item_type: string }[]>
> {
  try {
    await requirePermission('products:read');
    const rows = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        item_type: products.itemType,
      })
      .from(products)
      .where(eq(products.itemType, 'tool'))
      .orderBy(asc(products.name));
    return ok(rows);
  } catch (err) {
    return actionError(err);
  }
}

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(300),
  item_type: z.enum(ITEM_TYPES),
  current_stock: z.number().min(0).optional(),
  min_threshold: z.number().min(0),
  average_cost: z.number().min(0),
  unit_of_measure: z.string().trim().min(1).max(50),
  issuing_unit: z.string().trim().min(1).max(50),
  supplier_id: z.string().uuid().nullable().optional(),
  bin_location_id: z.string().uuid().nullable().optional(),
});

export async function upsertProduct(input: unknown): Promise<Result<ProductDTO>> {
  try {
    const ctx = await requirePermission('products:write');
    const data = upsertSchema.parse(input);

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const values = {
        sku: data.sku,
        name: data.name,
        itemType: data.item_type,
        ...(data.current_stock !== undefined
          ? { currentStock: String(data.current_stock) }
          : {}),
        minThreshold: String(data.min_threshold),
        averageCost: String(data.average_cost),
        unitOfMeasure: data.unit_of_measure,
        issuingUnit: data.issuing_unit,
        supplierId: data.supplier_id ?? null,
        binLocationId: data.bin_location_id ?? null,
      };
      if (data.id) {
        const [row] = await tx
          .update(products)
          .set(values)
          .where(eq(products.id, data.id))
          .returning(productSelect);
        return row;
      }
      const [row] = await tx
        .insert(products)
        .values({
          ...values,
          currentStock: String(data.current_stock ?? 0),
        })
        .returning(productSelect);
      return row;
    });

    if (!saved) return actionError(new Error('Product not found'));
    return ok(toDTO(saved));
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteProduct(id: string): Promise<Result<null>> {
  try {
    const ctx = await requirePermission('products:delete');
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) return actionError(new Error('Invalid id'));

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx.delete(products).where(eq(products.id, parsed.data));
    });
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
