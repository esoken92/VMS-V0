/**
 * GET /api/labels/{type}/{id}.svg — print-ready QR label carrying a signed
 * vms.v1 token.
 *
 *   type ∈ product | bin | take | tool     id = entity uuid + ".svg"
 *
 * Serving a label is a WRITE path: it mints a fresh token, persists its
 * hash to label_tokens, and CONSUMES the entity's prior token — so each
 * GET rotates the credential and older prints stop scanning (documented in
 * lib/pdf/label.ts). Authorization is per entity type.
 */

import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  activityLogs,
  binLocations,
  products,
  stockTakes,
} from '@/drizzle/schema';
import { labelTokens, SCAN_ENTITY_TYPES } from '@/drizzle/scan-schema';
import type { ScanEntityType } from '@/drizzle/scan-schema';
import { setAuditContext } from '@/lib/db/context';
import { can, requireUser } from '@/lib/auth/session';
import { AuthError } from '@/lib/result';
import type { Permission } from '@/lib/auth/permissions';
import { buildLabelSvg, issueLabel } from '@/lib/pdf/label';
import { isUuid } from '@/lib/scan/codes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TYPE_PERMISSION: Record<ScanEntityType, Permission> = {
  product: 'products:write',
  tool: 'products:write',
  bin: 'bin_locations:write',
  take: 'stock_takes:write',
};

interface EntityMeta {
  title: string;
  subtitle: string | null;
}

async function findEntity(
  type: ScanEntityType,
  id: string,
): Promise<EntityMeta | null> {
  switch (type) {
    case 'product':
    case 'tool': {
      const [p] = await db
        .select({ sku: products.sku, name: products.name, itemType: products.itemType })
        .from(products)
        .where(eq(products.id, id))
        .limit(1);
      if (!p) return null;
      if (type === 'tool' && p.itemType !== 'tool') return null;
      return { title: p.sku, subtitle: p.name };
    }
    case 'bin': {
      const [b] = await db
        .select({ zone: binLocations.zone, bin: binLocations.binLocation })
        .from(binLocations)
        .where(eq(binLocations.id, id))
        .limit(1);
      return b ? { title: `${b.zone}-${b.bin}`, subtitle: 'Bin location' } : null;
    }
    case 'take': {
      const [t] = await db
        .select({ id: stockTakes.id, status: stockTakes.status })
        .from(stockTakes)
        .where(eq(stockTakes.id, id))
        .limit(1);
      return t
        ? { title: `Take ${t.id.slice(0, 8)}`, subtitle: `Stock take — ${t.status}` }
        : null;
    }
  }
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ type: string; id: string }> }
) {
  const params = await props.params;
  let ctx;
  try {
    ctx = await requireUser();
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    throw err;
  }

  const type = params.type as ScanEntityType;
  if (!(SCAN_ENTITY_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: 'Unknown label type' }, { status: 400 });
  }

  // The route template is {id}.svg — split the suffix off.
  const rawId = params.id;
  if (!rawId.endsWith('.svg')) {
    return NextResponse.json(
      { error: 'Only .svg labels are served' },
      { status: 404 },
    );
  }
  const id = rawId.slice(0, -4);
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid entity id' }, { status: 400 });
  }

  if (!can(ctx.user.role, TYPE_PERMISSION[type])) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const meta = await findEntity(type, id);
  if (!meta) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  const issued = issueLabel(type, id);
  try {
    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });

      // Rotate: consume any still-active tokens for this entity.
      await tx
        .update(labelTokens)
        .set({ consumedAt: new Date() })
        .where(
          and(
            eq(labelTokens.entityType, type),
            eq(labelTokens.entityId, id),
            isNull(labelTokens.consumedAt),
          ),
        );

      await tx.insert(labelTokens).values({
        tokenHash: issued.tokenHash,
        entityType: type,
        entityId: id,
        iat: issued.iat,
        exp: issued.exp,
        createdBy: ctx.user.id,
      });

      // label_tokens has no audit trigger (new table) — log explicitly.
      await tx.insert(activityLogs).values({
        userId: ctx.user.id,
        impersonatedByUserId: ctx.impersonating ? ctx.actor.id : null,
        actionType: 'LABEL_ISSUE',
        tableName: 'label_tokens',
        recordId: id,
        newData: {
          entity_type: type,
          token_hash_prefix: issued.tokenHash.slice(0, 12),
          exp: issued.exp.toISOString(),
        },
      });
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to issue label' },
      { status: 500 },
    );
  }

  const svg = await buildLabelSvg(issued.token, issued.fallbackCode, meta);
  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Disposition': `inline; filename="vms-label-${type}-${id.slice(0, 8)}.svg"`,
      'Cache-Control': 'no-store',
    },
  });
}
