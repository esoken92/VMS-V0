'use server';

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { db } from '@/lib/db';
import { products, profiles, toolLoans } from '@/drizzle/schema';
import { setAuditContext } from '@/lib/db/context';
import { requirePermission, requireUser, can } from '@/lib/auth/session';
import { actionError, fail, ok, type Result } from '@/lib/result';
import type { ProfileOptionDTO, ToolLoanDTO } from '@/lib/types';

const worker = alias(profiles, 'worker');
const checker = alias(profiles, 'checker');

/**
 * List tool loans. `tool_loans:read:all` roles see everything; staff see
 * only loans where they are the worker (RLS parity).
 */
export async function listToolLoans(): Promise<Result<ToolLoanDTO[]>> {
  try {
    const ctx = await requireUser();
    const seeAll = can(ctx.user.role, 'tool_loans:read:all');

    const rows = await db
      .select({
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
      })
      .from(toolLoans)
      .leftJoin(products, eq(toolLoans.toolProductId, products.id))
      .leftJoin(worker, eq(toolLoans.workerProfileId, worker.id))
      .leftJoin(checker, eq(toolLoans.checkedOutByUserId, checker.id))
      .where(seeAll ? undefined : eq(toolLoans.workerProfileId, ctx.user.id))
      .orderBy(desc(toolLoans.checkedOutAt))
      .limit(200);

    return ok(
      rows.map((r) => ({
        ...r,
        checked_out_at: r.checked_out_at?.toISOString() ?? null,
        expected_return_at: r.expected_return_at?.toISOString() ?? null,
        returned_at: r.returned_at?.toISOString() ?? null,
      })),
    );
  } catch (err) {
    return actionError(err);
  }
}

/**
 * Profiles selectable as loan worker: `create:for_other` roles get the full
 * list; everyone else gets just themselves (self-checkout).
 */
export async function listAssignableWorkers(): Promise<Result<ProfileOptionDTO[]>> {
  try {
    const ctx = await requirePermission('tool_loans:create');
    if (!can(ctx.user.role, 'tool_loans:create:for_other')) {
      return ok([{ id: ctx.user.id, full_name: ctx.user.fullName }]);
    }
    const rows = await db
      .select({ id: profiles.id, full_name: profiles.fullName })
      .from(profiles)
      .orderBy(asc(profiles.fullName));
    return ok(rows);
  } catch (err) {
    return actionError(err);
  }
}

const checkoutSchema = z.object({
  tool_product_ids: z.array(z.string().uuid()).min(1).max(100),
  worker_profile_id: z.string().uuid().nullable().optional(),
  expected_return_at: z.string().datetime().nullable().optional(),
  condition_on_checkout: z.string().trim().min(1).max(100),
  notes: z.string().max(1000).nullable().optional(),
});

/**
 * Check out one or more tools — ports check_out_tool (007): validates the
 * product is a tool and has no active loan. Checking out for someone else
 * requires `tool_loans:create:for_other`.
 */
export async function checkOutTools(input: unknown): Promise<Result<{ count: number }>> {
  try {
    const ctx = await requirePermission('tool_loans:create');
    const data = checkoutSchema.parse(input);
    const workerId = data.worker_profile_id ?? ctx.user.id;

    if (workerId !== ctx.user.id && !can(ctx.user.role, 'tool_loans:create:for_other')) {
      return fail('Cannot check out a tool for another user', 'FORBIDDEN');
    }

    const expectedReturn = data.expected_return_at
      ? new Date(data.expected_return_at)
      : null;

    const count = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      let inserted = 0;
      for (const toolId of data.tool_product_ids) {
        const [product] = await tx
          .select({ id: products.id, item_type: products.itemType })
          .from(products)
          .where(eq(products.id, toolId))
          .limit(1);
        if (!product) throw new Error('Product not found');
        if (product.item_type !== 'tool') throw new Error('Product is not a tool');

        const [active] = await tx
          .select({ id: toolLoans.id })
          .from(toolLoans)
          .where(and(eq(toolLoans.toolProductId, toolId), isNull(toolLoans.returnedAt)))
          .limit(1);
        if (active) throw new Error('Tool is already checked out');

        await tx.insert(toolLoans).values({
          toolProductId: toolId,
          workerProfileId: workerId,
          checkedOutByUserId: ctx.user.id,
          expectedReturnAt: expectedReturn,
          conditionOnCheckout: data.condition_on_checkout,
          notes: data.notes ?? null,
        });
        inserted += 1;
      }
      return inserted;
    });

    return ok({ count });
  } catch (err) {
    return actionError(err);
  }
}

const returnSchema = z.object({
  loan_ids: z.array(z.string().uuid()).min(1).max(100),
  condition_on_return: z.string().trim().min(1).max(100),
});

/**
 * Return one or more tools — ports return_tool (007) with a real ownership
 * check: `tool_loans:return:any` roles may return anything; others only
 * loans where they are the worker.
 */
export async function returnTools(input: unknown): Promise<Result<{ count: number }>> {
  try {
    const ctx = await requireUser();
    const data = returnSchema.parse(input);
    const canAny = can(ctx.user.role, 'tool_loans:return:any');

    const count = await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      let updated = 0;
      for (const loanId of data.loan_ids) {
        const [loan] = await tx
          .select({
            id: toolLoans.id,
            worker_profile_id: toolLoans.workerProfileId,
            returned_at: toolLoans.returnedAt,
          })
          .from(toolLoans)
          .where(eq(toolLoans.id, loanId))
          .limit(1);
        if (!loan) throw new Error('Loan not found');
        if (loan.returned_at) throw new Error('Tool has already been returned');
        if (!canAny && loan.worker_profile_id !== ctx.user.id) {
          throw new Error('Cannot return a loan held by another user');
        }

        await tx
          .update(toolLoans)
          .set({ returnedAt: new Date(), conditionOnReturn: data.condition_on_return })
          .where(eq(toolLoans.id, loanId));
        updated += 1;
      }
      return updated;
    });

    return ok({ count });
  } catch (err) {
    return actionError(err);
  }
}
