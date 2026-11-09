'use server';

import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { binLocations } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requirePermission } from '@/lib/auth/session';
import { actionError, ok, type Result } from '@/lib/result';
import type { BinLocationDTO } from '@/lib/types';

export async function listBinLocations(): Promise<Result<BinLocationDTO[]>> {
  try {
    await requirePermission('bin_locations:read');
    const rows = await db
      .select({
        id: binLocations.id,
        zone: binLocations.zone,
        bin_location: binLocations.binLocation,
        max_weight_kg: binLocations.maxWeightKg,
        description: binLocations.description,
      })
      .from(binLocations)
      .orderBy(asc(binLocations.zone), asc(binLocations.binLocation));

    return ok(
      rows.map((r) => ({
        ...r,
        max_weight_kg: Number(r.max_weight_kg),
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  zone: z.string().trim().min(1).max(100),
  bin_location: z.string().trim().min(1).max(100),
  max_weight_kg: z.number().min(0),
  description: z.string().max(1000).nullable().optional(),
});

export async function upsertBinLocation(input: unknown): Promise<Result<BinLocationDTO>> {
  try {
    const ctx = await requirePermission('bin_locations:write');
    const data = upsertSchema.parse(input);

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const values = {
        zone: data.zone,
        binLocation: data.bin_location,
        maxWeightKg: String(data.max_weight_kg),
        description: data.description ?? null,
      };
      if (data.id) {
        const [row] = await tx
          .update(binLocations)
          .set(values)
          .where(eq(binLocations.id, data.id))
          .returning({
            id: binLocations.id,
            zone: binLocations.zone,
            bin_location: binLocations.binLocation,
            max_weight_kg: binLocations.maxWeightKg,
            description: binLocations.description,
          });
        return row;
      }
      const [row] = await tx
        .insert(binLocations)
        .values(values)
        .returning({
          id: binLocations.id,
          zone: binLocations.zone,
          bin_location: binLocations.binLocation,
          max_weight_kg: binLocations.maxWeightKg,
          description: binLocations.description,
        });
      return row;
    });

    if (!saved) return actionError(new Error('Bin location not found'));
    return ok({ ...saved, max_weight_kg: Number(saved.max_weight_kg) });
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteBinLocation(id: string): Promise<Result<null>> {
  try {
    const ctx = await requirePermission('bin_locations:write');
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) return actionError(new Error('Invalid id'));

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx.delete(binLocations).where(eq(binLocations.id, parsed.data));
    });
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
