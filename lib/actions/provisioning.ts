'use server';

/**
 * lib/actions/provisioning — the setup wizard's server surface.
 *
 *   getProvisioning()          → stored ProvisioningConfig | null
 *                                (null = unprovisioned → "Finish setup" banner)
 *   getProvisioningPreview(in) → the computed flag/nav/report/storeroom
 *                                diff the Review step renders — writes NOTHING.
 *   applyProvisioning(in)      → validates, derives packs (incl. the
 *                                cold_chain pack for temperature-sensitive
 *                                stock), upserts the 'provisioning' row in
 *                                instance_config, and — in the same
 *                                transaction — creates the pack-derived
 *                                storeroom presets, skipping rooms whose
 *                                name already exists (case-insensitive, so
 *                                re-runs and seed rooms stay idempotent).
 *                                The instance_config + storerooms audit
 *                                triggers write the activity_logs entries
 *                                (actor set via setAuditContext in the tx).
 *   getFeatureFlags()          → derived FeatureFlag[] for consumers
 *                                (nav, product form). null = unprovisioned.
 *   get/saveProductTracking    → per-product tracking attributes the
 *                                feature-flagged product form fields use
 *                                (stored in instance_config under
 *                                'product_tracking.<productId>' until real
 *                                columns land).
 *
 * Authorization (server-side, every call):
 *   reads            → requireUser() (operators' nav also needs flags)
 *   config writes    → requireRole(BUILDER_ROLES) — same gate the
 *                      /dashboard/setup route uses (lib/persona.ts)
 *   tracking writes  → requirePermission('products:write') — product-level
 *                      writes follow product permissions, not config ones.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { instanceConfig } from '@/drizzle/instance-config-schema';
import { storerooms } from '@/drizzle/storerooms-schema';
import { setAuditContext, type Tx } from '@/lib/db/context';
import {
  requirePermission,
  requireRole,
  requireUser,
} from '@/lib/auth/session';
import { BUILDER_ROLES } from '@/lib/persona';
import { actionError, fail, ok, type Result } from '@/lib/result';
import { navigationConfig } from '@/lib/navigation-config';
import { storeroomPresetsFor } from '@/lib/industry-presets';
import {
  deriveFeatures,
  deriveReportPacks,
  packsForInput,
  EXPIRY_POLICIES,
  FEATURE_FLAGS,
  INDUSTRIES,
  PACKS,
  PICKING_ENFORCEMENTS,
  PICKING_STRATEGIES,
  VALUATION_METHODS,
  type ApplyProvisioningResult,
  type FeatureFlag,
  type ProductTrackingAttributes,
  type ProvisioningConfig,
  type ProvisioningPreview,
} from '@/lib/features';

const PROVISIONING_KEY = 'provisioning';
const TRACKING_KEY_PREFIX = 'product_tracking.';

// ============================================================================
// VALIDATION — every boundary parses with Zod; the stored shape is the same
// schema so reads of previously-written config validate identically.
// ============================================================================

const stockSchema = z.object({
  perishable: z.boolean(),
  // Optional with default so configs stored before this characteristic
  // existed still parse (older rows simply default to false).
  temperature_sensitive: z.boolean().default(false),
  serialized: z.boolean(),
  hazmat: z.boolean(),
  tools_loanable: z.boolean(),
  vehicle_parts: z.boolean(),
  consumables: z.boolean(),
});

const policiesSchema = z.object({
  picking_strategy: z.enum(PICKING_STRATEGIES),
  picking_enforcement: z.enum(PICKING_ENFORCEMENTS),
  valuation_method: z.enum(VALUATION_METHODS),
  expiry_policy: z.enum(EXPIRY_POLICIES),
});

/** Wizard input (what the client sends). Packs are derived server-side. */
const provisioningInputSchema = z.object({
  industries: z
    .array(z.enum(INDUSTRIES))
    .min(1, 'Select at least one industry')
    .max(INDUSTRIES.length),
  stock: stockSchema,
  policies: policiesSchema,
});

/** Stored config — input + derived packs + version + applied timestamp. */
const provisioningConfigSchema = provisioningInputSchema.extend({
  v: z.literal(1),
  packs: z.array(z.enum(PACKS)),
  applied_at: z.string(),
});

const productTrackingSchema = z.object({
  expiry_tracked: z.boolean().default(false),
  serialized: z.boolean().default(false),
});

// ============================================================================
// READS
// ============================================================================

/**
 * The stored provisioning config, or null when the instance has not been
 * provisioned (that null is what shows the builder "Finish setup" banner).
 */
export async function getProvisioning(): Promise<
  Result<ProvisioningConfig | null>
> {
  try {
    await requireUser();
    const rows = await db
      .select({ value: instanceConfig.value })
      .from(instanceConfig)
      .where(eq(instanceConfig.key, PROVISIONING_KEY))
      .limit(1);
    const row = rows[0];
    if (!row) return ok(null);

    const parsed = provisioningConfigSchema.safeParse(row.value);
    if (!parsed.success) {
      return fail(
        'Stored provisioning config does not match the v1 shape — re-run setup',
        'VALIDATION',
      );
    }
    return ok(parsed.data);
  } catch (err) {
    return actionError(err);
  }
}

/**
 * Feature flags derived from the stored config, for flag consumers
 * (navigation, product form). null → unprovisioned → everything enabled.
 */
export async function getFeatureFlags(): Promise<
  Result<FeatureFlag[] | null>
> {
  try {
    await requireUser();
    const res = await getProvisioning();
    if (!res.success) return res;
    if (res.data === null) return ok(null);
    return ok([...deriveFeatures(res.data)]);
  } catch (err) {
    return actionError(err);
  }
}

// ============================================================================
// PREVIEW — same derivation as apply, no writes.
// ============================================================================

export async function getProvisioningPreview(
  input: unknown,
): Promise<Result<ProvisioningPreview>> {
  try {
    await requireUser();
    const data = provisioningInputSchema.parse(input);

    const packs = packsForInput(data.industries, data.stock);
    const flags = deriveFeatures({ stock: data.stock, policies: data.policies, packs });
    const enabledFlags = FEATURE_FLAGS.filter((f) => flags.has(f));
    const disabledFlags = FEATURE_FLAGS.filter((f) => !flags.has(f));

    const nav = navigationConfig
      .filter((item) => item.feature)
      .map((item) => ({
        label: item.label,
        href: item.href,
        visible: flags.has(item.feature!),
      }));

    // Proposed storerooms — mark which already exist so Apply is
    // honest about what it will actually create (idempotent by name).
    const roomPresets = storeroomPresetsFor(packs);
    const existing = await existingRoomNames(roomPresets.map((r) => r.name));

    return ok({
      config: {
        v: 1,
        industries: data.industries,
        packs,
        stock: data.stock,
        policies: data.policies,
      },
      enabled_flags: enabledFlags,
      disabled_flags: disabledFlags,
      nav,
      report_packs: deriveReportPacks(flags),
      storeroom_presets: roomPresets.map((r) => ({
        name: r.name,
        type: r.type,
        type_label: r.type_label,
        description: r.description,
        temp_min: r.temp_min,
        temp_max: r.temp_max,
        access_level: r.access_level,
        quarantine: r.quarantine,
        exists: existing.has(r.name.trim().toLowerCase()),
      })),
    });
  } catch (err) {
    return actionError(err);
  }
}

// ============================================================================
// APPLY — upsert the 'provisioning' row + create pack-proposed storerooms.
// Audit triggers log both writes. Room creation is additive and idempotent:
// a preset whose name (case-insensitive) already exists is skipped, never
// overwritten — user-created or previously seeded rooms are left untouched.
// ============================================================================

/** A queryable scope — the db client or an open transaction. */
type Queryable = Pick<typeof db, 'select'> | Tx;

/** Lower-cased names of existing rooms among `names` (one batched query). */
async function existingRoomNames(
  names: readonly string[],
  q: Queryable = db,
): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const lowered = names.map((n) => n.trim().toLowerCase());
  const rows = await q
    .select({ name: storerooms.name })
    .from(storerooms)
    .where(inArray(sql`lower(${storerooms.name})`, lowered));
  return new Set(rows.map((r) => r.name.trim().toLowerCase()));
}

export async function applyProvisioning(
  input: unknown,
): Promise<Result<ApplyProvisioningResult>> {
  try {
    const ctx = await requireRole([...BUILDER_ROLES]);
    const data = provisioningInputSchema.parse(input);

    const packs = packsForInput(data.industries, data.stock);
    const config: ProvisioningConfig = {
      v: 1,
      industries: data.industries,
      packs,
      stock: data.stock,
      policies: data.policies,
      applied_at: new Date().toISOString(),
    };

    const roomPresets = storeroomPresetsFor(packs);
    const storeroomsCreated: string[] = [];
    const storeroomsSkipped: string[] = [];

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx
        .insert(instanceConfig)
        .values({
          key: PROVISIONING_KEY,
          value: config,
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: instanceConfig.key,
          set: {
            value: config,
            updatedBy: ctx.user.id,
            updatedAt: new Date(),
          },
        });

      // Seed the pack-proposed storerooms — same name check the preview
      // reported, re-evaluated inside the transaction.
      const existing = await existingRoomNames(
        roomPresets.map((r) => r.name),
        tx,
      );
      const toInsert = roomPresets.filter((r) => {
        if (existing.has(r.name.trim().toLowerCase())) {
          storeroomsSkipped.push(r.name);
          return false;
        }
        storeroomsCreated.push(r.name);
        return true;
      });
      if (toInsert.length > 0) {
        await tx.insert(storerooms).values(
          toInsert.map((r) => ({
            name: r.name,
            type: r.type,
            description: r.description,
            tempMin: r.temp_min === null ? null : String(r.temp_min),
            tempMax: r.temp_max === null ? null : String(r.temp_max),
            accessLevel: r.access_level,
            allowedRoles: r.allowed_roles,
            featureToggles: r.feature_toggles,
            quarantine: r.quarantine,
            active: true,
            updatedAt: new Date(),
          })),
        );
      }
    });

    return ok({
      config,
      storerooms_created: storeroomsCreated,
      storerooms_skipped: storeroomsSkipped,
    });
  } catch (err) {
    return actionError(err);
  }
}

// ============================================================================
// PRODUCT TRACKING ATTRIBUTES — the flag-gated fields on the product form.
// Stored in instance_config under 'product_tracking.<productId>' so they
// persist honestly without touching the products schema owned elsewhere.
// ============================================================================

export async function getProductTracking(
  productId: string,
): Promise<Result<ProductTrackingAttributes | null>> {
  try {
    await requirePermission('products:read');
    const id = z.string().uuid().parse(productId);
    const rows = await db
      .select({ value: instanceConfig.value })
      .from(instanceConfig)
      .where(eq(instanceConfig.key, `${TRACKING_KEY_PREFIX}${id}`))
      .limit(1);
    const row = rows[0];
    if (!row) return ok(null);
    const parsed = productTrackingSchema.safeParse(row.value);
    return parsed.success ? ok(parsed.data) : ok(null);
  } catch (err) {
    return actionError(err);
  }
}

export async function saveProductTracking(
  input: unknown,
): Promise<Result<ProductTrackingAttributes>> {
  try {
    const ctx = await requirePermission('products:write');
    const data = productTrackingSchema
      .extend({ product_id: z.string().uuid() })
      .parse(input);
    const value: Record<string, unknown> = {
      v: 1,
      expiry_tracked: data.expiry_tracked,
      serialized: data.serialized,
    };

    await db.transaction(async (tx) => {
      await setAuditContext(tx, {
        userId: ctx.user.id,
        impersonatorId: ctx.impersonating ? ctx.actor.id : null,
      });
      await tx
        .insert(instanceConfig)
        .values({
          key: `${TRACKING_KEY_PREFIX}${data.product_id}`,
          value,
          updatedBy: ctx.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: instanceConfig.key,
          set: { value, updatedBy: ctx.user.id, updatedAt: new Date() },
        });
    });

    return ok({
      expiry_tracked: data.expiry_tracked,
      serialized: data.serialized,
    });
  } catch (err) {
    return actionError(err);
  }
}
