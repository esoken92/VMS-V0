'use server';

/**
 * lib/actions/provisioning — the setup wizard's server surface.
 *
 *   getProvisioning()          → stored ProvisioningConfig | null
 *                                (null = unprovisioned → "Finish setup" banner)
 *   getProvisioningPreview(in) → the computed flag/nav/report diff the
 *                                Review step renders — writes NOTHING.
 *   applyProvisioning(in)      → validates, derives packs, upserts the
 *                                'provisioning' row in instance_config.
 *                                The instance_config audit trigger writes
 *                                the activity_logs entry (with the actor
 *                                set via setAuditContext in the same tx).
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

import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { instanceConfig } from '@/drizzle/instance-config-schema';
import { setAuditContext } from '@/lib/db/context';
import {
  requirePermission,
  requireRole,
  requireUser,
} from '@/lib/auth/session';
import { BUILDER_ROLES } from '@/lib/persona';
import { actionError, fail, ok, type Result } from '@/lib/result';
import { navigationConfig } from '@/lib/navigation-config';
import {
  deriveFeatures,
  deriveReportPacks,
  packsForIndustries,
  EXPIRY_POLICIES,
  FEATURE_FLAGS,
  INDUSTRIES,
  PACKS,
  PICKING_ENFORCEMENTS,
  PICKING_STRATEGIES,
  VALUATION_METHODS,
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

    const packs = packsForIndustries(data.industries);
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
    });
  } catch (err) {
    return actionError(err);
  }
}

// ============================================================================
// APPLY — upsert the 'provisioning' row. Audit trigger logs the write.
// ============================================================================

export async function applyProvisioning(
  input: unknown,
): Promise<Result<ProvisioningConfig>> {
  try {
    const ctx = await requireRole([...BUILDER_ROLES]);
    const data = provisioningInputSchema.parse(input);

    const config: ProvisioningConfig = {
      v: 1,
      industries: data.industries,
      packs: packsForIndustries(data.industries),
      stock: data.stock,
      policies: data.policies,
      applied_at: new Date().toISOString(),
    };

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
    });

    return ok(config);
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
