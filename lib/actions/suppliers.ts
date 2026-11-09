'use server';

import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { suppliers } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requirePermission } from '@/lib/auth/session';
import { actionError, ok, type Result } from '@/lib/result';
import type { SupplierDTO } from '@/lib/types';

export async function listSuppliers(): Promise<Result<SupplierDTO[]>> {
  try {
    await requirePermission('suppliers:read');
    const rows = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        contact_email: suppliers.contactEmail,
        phone: suppliers.phone,
        address: suppliers.address,
      })
      .from(suppliers)
      .orderBy(asc(suppliers.name));
    return ok(rows);
  } catch (err) {
    return actionError(err);
  }
}

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  contact_email: z.string().email().max(320).nullable().optional().or(z.literal('')),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(1000).nullable().optional(),
});

export async function upsertSupplier(input: unknown): Promise<Result<SupplierDTO>> {
  try {
    const ctx = await requirePermission('suppliers:write');
    const data = upsertSchema.parse(input);

    const saved = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      const values = {
        name: data.name,
        contactEmail: data.contact_email || null,
        phone: data.phone || null,
        address: data.address || null,
      };
      if (data.id) {
        const [row] = await tx
          .update(suppliers)
          .set(values)
          .where(eq(suppliers.id, data.id))
          .returning({
            id: suppliers.id,
            name: suppliers.name,
            contact_email: suppliers.contactEmail,
            phone: suppliers.phone,
            address: suppliers.address,
          });
        return row;
      }
      const [row] = await tx
        .insert(suppliers)
        .values(values)
        .returning({
          id: suppliers.id,
          name: suppliers.name,
          contact_email: suppliers.contactEmail,
          phone: suppliers.phone,
          address: suppliers.address,
        });
      return row;
    });

    if (!saved) return actionError(new Error('Supplier not found'));
    return ok(saved);
  } catch (err) {
    return actionError(err);
  }
}

export async function deleteSupplier(id: string): Promise<Result<null>> {
  try {
    const ctx = await requirePermission('suppliers:delete');
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) return actionError(new Error('Invalid id'));

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx.delete(suppliers).where(eq(suppliers.id, parsed.data));
    });
    return ok(null);
  } catch (err) {
    return actionError(err);
  }
}
