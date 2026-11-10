/**
 * lib/features — provisioning-derived feature flags + the wizard's option
 * vocabulary (industries, stock characteristics, policies, packs).
 *
 * PURE + edge-safe: no DB, no next/headers, no node-only APIs — safe to
 * import from middleware, client components and server actions alike.
 *
 * Semantics:
 *   - The template ships ALL functionality. An UNPROVISIONED instance
 *     (no 'provisioning' row in instance_config) therefore has every
 *     feature flag ON — `isFeatureEnabled` treats null/unknown as on.
 *   - Once the setup wizard runs, the stored ProvisioningConfig derives
 *     a flag set; flags that are off hide UI only — data is never
 *     deleted or invalidated.
 *   - Client components read the flag set through a tiny module-level
 *     cache (`setClientFeatures`, populated once by the dashboard
 *     layout after calling getFeatureFlags()). Server-side callers pass
 *     the flag set explicitly.
 */

// ============================================================================
// WIZARD VOCABULARY
// ============================================================================

export const INDUSTRIES = [
  'general_retail',
  'food_beverage',
  'pharma_medical',
  'automotive_fleet',
  'tools_equipment',
  'agriculture',
  'manufacturing',
  'government_education',
] as const;
export type IndustryId = (typeof INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<IndustryId, string> = {
  general_retail: 'General / retail',
  food_beverage: 'Food & beverage',
  pharma_medical: 'Pharma & medical',
  automotive_fleet: 'Automotive & fleet',
  tools_equipment: 'Tools & equipment',
  agriculture: 'Agriculture',
  manufacturing: 'Manufacturing',
  government_education: 'Government & education',
};

export const STOCK_CHARACTERISTICS = [
  'perishable',
  'temperature_sensitive',
  'serialized',
  'hazmat',
  'tools_loanable',
  'vehicle_parts',
  'consumables',
] as const;
export type StockCharacteristic = (typeof STOCK_CHARACTERISTICS)[number];

export const STOCK_CHARACTERISTIC_LABELS: Record<StockCharacteristic, string> = {
  perishable: 'Perishable / expiry-tracked',
  temperature_sensitive: 'Temperature-sensitive (cold chain)',
  serialized: 'Serialized items',
  hazmat: 'Hazmat / regulated',
  tools_loanable: 'Loanable tools & equipment',
  vehicle_parts: 'Vehicle parts',
  consumables: 'Consumables',
};

export const PICKING_STRATEGIES = [
  'fifo',
  'lifo',
  'fefo',
  'suggest_only',
] as const;
export type PickingStrategy = (typeof PICKING_STRATEGIES)[number];

export const PICKING_STRATEGY_LABELS: Record<PickingStrategy, string> = {
  fifo: 'FIFO — first in, first out',
  lifo: 'LIFO — last in, first out',
  fefo: 'FEFO — first expired, first out',
  suggest_only: 'Suggest only — no enforced order',
};

export const PICKING_ENFORCEMENTS = ['suggest', 'warn', 'block'] as const;
export type PickingEnforcement = (typeof PICKING_ENFORCEMENTS)[number];

export const PICKING_ENFORCEMENT_LABELS: Record<PickingEnforcement, string> = {
  suggest: 'Suggest — show the recommended pick',
  warn: 'Warn — allow off-policy picks with a warning',
  block: 'Block — refuse off-policy picks',
};

export const VALUATION_METHODS = [
  'weighted_average',
  'fifo',
  'lifo',
  'standard_cost',
] as const;
export type ValuationMethod = (typeof VALUATION_METHODS)[number];

export const VALUATION_METHOD_LABELS: Record<ValuationMethod, string> = {
  weighted_average: 'Weighted average cost',
  fifo: 'FIFO layers',
  lifo: 'LIFO layers',
  standard_cost: 'Standard cost',
};

export const EXPIRY_POLICIES = [
  'none',
  'track',
  'enforce_fefo',
  'enforce_fefo_quarantine',
] as const;
export type ExpiryPolicy = (typeof EXPIRY_POLICIES)[number];

export const EXPIRY_POLICY_LABELS: Record<ExpiryPolicy, string> = {
  none: 'None — no expiry tracking',
  track: 'Track — record expiry dates, no picking enforcement',
  enforce_fefo: 'Enforce FEFO — expired/expiring stock cannot be picked',
  enforce_fefo_quarantine:
    'Enforce FEFO + quarantine — expired stock moves to quarantine',
};

// ============================================================================
// PACKS — derived from the industry selection, stored on the config so the
// deployment self-documents which capability bundles it runs.
// ============================================================================

export const PACKS = [
  'stock_control',
  'perishables',
  'regulated_items',
  'fleet_parts',
  'tool_crib',
  'industrial_stock',
  'asset_issue',
  'cold_chain',
] as const;
export type PackId = (typeof PACKS)[number];

export const PACK_LABELS: Record<PackId, string> = {
  stock_control: 'Stock control (catalog, bins, counts)',
  perishables: 'Perishables (expiry & batches)',
  regulated_items: 'Regulated items (compliance fields)',
  fleet_parts: 'Fleet parts (vehicle maintenance stock)',
  tool_crib: 'Tool crib (checkout/return custody)',
  industrial_stock: 'Industrial stock (MRO & raw material)',
  asset_issue: 'Asset issue (departmental issuing)',
  cold_chain: 'Cold chain (temperature-monitored storage)',
};

const INDUSTRY_PACKS: Record<IndustryId, readonly PackId[]> = {
  general_retail: ['stock_control'],
  // HACCP/receiving-temp verification is M-tier for food service
  // (docs/research/04 §9) → cold_chain.
  food_beverage: ['stock_control', 'perishables', 'cold_chain'],
  // Pharma needs temperature-zone mapping (§1) on top of expiry+regulated.
  pharma_medical: ['stock_control', 'perishables', 'regulated_items', 'cold_chain'],
  // Fleet operations run a real storeroom: bins, counts and consumables
  // (fluids/filters) alongside parts + tools → stock_control included.
  automotive_fleet: ['stock_control', 'fleet_parts', 'tool_crib'],
  tools_equipment: ['tool_crib'],
  agriculture: ['stock_control', 'perishables'],
  manufacturing: ['stock_control', 'industrial_stock'],
  government_education: ['stock_control', 'asset_issue'],
};

// ============================================================================
// FEATURE FLAGS — the capability toggles consumers actually gate on.
// ============================================================================

export const FEATURE_FLAGS = [
  'expiry',
  'fefo',
  'serialization',
  'hazmat',
  'tool_loans',
  'vehicle_parts',
  'consumables',
  'stock_takes',
  'cold_chain',
  'quarantine',
  'work_order_ref',
  'asset_lifecycle',
  'funding_codes',
] as const;
export type FeatureFlag = (typeof FEATURE_FLAGS)[number];

export const FEATURE_FLAG_LABELS: Record<FeatureFlag, string> = {
  expiry: 'Expiry tracking',
  fefo: 'FEFO picking',
  serialization: 'Serialization',
  hazmat: 'Hazmat / regulated handling',
  tool_loans: 'Tool loans',
  vehicle_parts: 'Vehicle parts',
  consumables: 'Consumables',
  stock_takes: 'Stock takes',
  cold_chain: 'Cold chain monitoring',
  quarantine: 'Quarantine workflow',
  work_order_ref: 'Job / work-order references',
  asset_lifecycle: 'Asset lifecycle & warranty',
  funding_codes: 'Funding / grant codes',
};

// ============================================================================
// PROVISIONING CONFIG — shape of the instance_config row under
// key 'provisioning'. `v` versions the shape for future migrations.
// ============================================================================

/** Stock characteristic booleans, keyed by StockCharacteristic. */
export type StockCharacteristics = Record<StockCharacteristic, boolean>;

/** `type` (not `interface`) so these get implicit index signatures —
 *  the config stores into a `Record<string, unknown>` jsonb column. */
export type ProvisioningPolicies = {
  picking_strategy: PickingStrategy;
  picking_enforcement: PickingEnforcement;
  valuation_method: ValuationMethod;
  expiry_policy: ExpiryPolicy;
};

export type ProvisioningConfig = {
  v: 1;
  industries: IndustryId[];
  /** Packs derived from `industries` at apply time (stored, self-documents). */
  packs: PackId[];
  stock: StockCharacteristics;
  policies: ProvisioningPolicies;
  /** ISO timestamp of the last applyProvisioning() write. */
  applied_at: string;
}

/** What the wizard sends to the server (packs are derived server-side). */
export type ProvisioningInput = {
  industries: IndustryId[];
  stock: StockCharacteristics;
  policies: ProvisioningPolicies;
};

/** Per-product tracking attributes the feature flags expose on the form. */
export type ProductTrackingAttributes = {
  expiry_tracked: boolean;
  serialized: boolean;
};

// ============================================================================
// DERIVATION
// ============================================================================

/** Packs implied by the industry selection (sorted, de-duplicated). */
export function packsForIndustries(industries: readonly IndustryId[]): PackId[] {
  const set = new Set<PackId>();
  for (const ind of industries) {
    for (const p of INDUSTRY_PACKS[ind] ?? []) set.add(p);
  }
  return [...set].sort();
}

/**
 * Effective packs for a full provisioning input — the industry-derived set
 * plus any pack a stock declaration implies. Declaring temperature-sensitive
 * stock activates the cold_chain bundle (monitored cold/frozen storerooms,
 * excursion reporting) even when no picked industry implies it — e.g. a
 * general retailer stocking chilled goods.
 */
export function packsForInput(
  industries: readonly IndustryId[],
  stock: { temperature_sensitive?: boolean },
): PackId[] {
  const set = new Set<PackId>(packsForIndustries(industries));
  if (stock.temperature_sensitive) set.add('cold_chain');
  return [...set].sort();
}

/**
 * Compute the enabled feature-flag set for a provisioning config.
 * Pass `null` (unprovisioned) to get every flag — the template ships
 * fully enabled until the wizard narrows it.
 */
export function deriveFeatures(
  config: Pick<ProvisioningConfig, 'stock' | 'policies'> & {
    packs?: readonly PackId[];
    industries?: readonly IndustryId[];
  } | null,
): Set<FeatureFlag> {
  if (!config) return new Set(FEATURE_FLAGS);

  const packs = new Set<PackId>(
    config.packs ?? packsForInput(config.industries ?? [], config.stock),
  );
  const { stock, policies } = config;
  const flags = new Set<FeatureFlag>();

  const expiry =
    stock.perishable ||
    stock.temperature_sensitive || // cold-chain stock is perishable (§1.6, §9.1)
    packs.has('perishables') ||
    packs.has('regulated_items') ||
    packs.has('cold_chain') ||
    policies.expiry_policy !== 'none';
  if (expiry) flags.add('expiry');

  if (
    policies.expiry_policy === 'enforce_fefo' ||
    policies.expiry_policy === 'enforce_fefo_quarantine' ||
    policies.picking_strategy === 'fefo'
  ) {
    flags.add('fefo');
  }

  if (
    stock.serialized ||
    packs.has('regulated_items') ||
    packs.has('fleet_parts') ||
    packs.has('industrial_stock') // critical spares are serial+lot tracked (§6.5)
  ) {
    flags.add('serialization');
  }

  if (
    stock.hazmat ||
    packs.has('regulated_items') ||
    packs.has('industrial_stock')
  ) {
    flags.add('hazmat');
  }

  if (
    stock.tools_loanable ||
    packs.has('tool_crib') ||
    // Departmental/member issue is the same checkout-return machinery —
    // school equipment lending (§3.1) and gov custody (§4.1) ride on it.
    packs.has('asset_issue')
  ) {
    flags.add('tool_loans');
  }

  if (stock.vehicle_parts || packs.has('fleet_parts')) {
    flags.add('vehicle_parts');
  }

  if (
    stock.consumables ||
    packs.has('stock_control') ||
    packs.has('perishables') ||
    packs.has('industrial_stock')
  ) {
    flags.add('consumables');
  }

  // Quantity-bearing stock → cycle counting matters. A pure tool-crib
  // deployment (custody items only, e.g. "Tools & equipment" alone) does
  // not count quantities, so Stock Takes is the honest thing to hide.
  if (
    stock.consumables ||
    stock.perishable ||
    stock.serialized ||
    stock.hazmat ||
    stock.vehicle_parts ||
    [...packs].some((p) => p !== 'tool_crib')
  ) {
    flags.add('stock_takes');
  }

  // ---- Phase-2m vertical depth (M-priority items in docs/research/04) ----

  // Cold chain: temperature-monitored zones + excursion evidence.
  // M for pharma (§1.7), healthcare vaccine storage (§2.5), food
  // receiving-temp + HACCP (§9.3–4), labs storage classes (§8.3).
  if (packs.has('cold_chain') || stock.temperature_sensitive) {
    flags.add('cold_chain');
  }

  // Quarantine → release gating. M for pharma (§1.5), food
  // reject-at-receipt (§9.3), hazmat holds; the enforce+quarantine expiry
  // policy explicitly asks for it.
  if (
    packs.has('regulated_items') ||
    stock.hazmat ||
    policies.expiry_policy === 'enforce_fefo_quarantine'
  ) {
    flags.add('quarantine');
  }

  // Job / work-order reference on issues — cost attribution. M for fleet
  // (item 165), construction job allocation (§5.1–2), MRO WO lifecycle
  // (§6.3); also the project-costing dimension (item 333).
  if (
    packs.has('fleet_parts') ||
    packs.has('industrial_stock') ||
    stock.vehicle_parts
  ) {
    flags.add('work_order_ref');
  }

  // Asset lifecycle states + warranty/service tracking. M for education
  // (§3.5), gov property book (§4.1), fleet service contracts (items
  // 179–181).
  if (packs.has('asset_issue') || packs.has('fleet_parts')) {
    flags.add('asset_lifecycle');
  }

  // Funding-source tagging on receipts/issues + by-grant reporting.
  // M for education grants (§3.4, GASB 34) and gov property (§4.6).
  if (packs.has('asset_issue')) {
    flags.add('funding_codes');
  }

  return flags;
}

// ============================================================================
// REPORT PACKS — reporting bundles the configuration activates. Declarative
// for now: the Reports page surfaces what exists today; these ids record
// which report families this deployment should offer.
// ============================================================================

export const REPORT_PACKS = [
  'inventory_valuation',
  'stock_variance',
  'expiry_register',
  'serial_register',
  'tool_custody',
  'hazmat_register',
  'fleet_usage',
  'temp_excursion',
  'quarantine_register',
  'job_costing',
  'asset_register',
  'funding_report',
] as const;
export type ReportPackId = (typeof REPORT_PACKS)[number];

export const REPORT_PACK_LABELS: Record<ReportPackId, string> = {
  inventory_valuation: 'Inventory valuation',
  stock_variance: 'Stock-take variance',
  expiry_register: 'Expiry register',
  serial_register: 'Serial-number register',
  tool_custody: 'Tool custody & overdue loans',
  hazmat_register: 'Hazmat / regulated register',
  fleet_usage: 'Fleet parts usage',
  temp_excursion: 'Temperature excursion log',
  quarantine_register: 'Quarantine & disposition register',
  job_costing: 'Job / work-order costing',
  asset_register: 'Asset & property register',
  funding_report: 'Funding source report',
};

export function deriveReportPacks(
  flags: ReadonlySet<FeatureFlag>,
): ReportPackId[] {
  const packs = new Set<ReportPackId>();
  // Every provisioned deployment values stock with its chosen method.
  packs.add('inventory_valuation');
  if (flags.has('stock_takes')) packs.add('stock_variance');
  if (flags.has('expiry')) packs.add('expiry_register');
  if (flags.has('serialization')) packs.add('serial_register');
  if (flags.has('tool_loans')) packs.add('tool_custody');
  if (flags.has('hazmat')) packs.add('hazmat_register');
  if (flags.has('vehicle_parts')) packs.add('fleet_usage');
  // Vertical report families (docs/research/04, M-priority):
  if (flags.has('cold_chain')) packs.add('temp_excursion'); // §1.7, §9.4
  if (flags.has('quarantine')) packs.add('quarantine_register'); // §1.5, §9.3
  if (flags.has('work_order_ref')) packs.add('job_costing'); // §5.1, item 333
  if (flags.has('asset_lifecycle')) packs.add('asset_register'); // §3.5, §4.1
  if (flags.has('funding_codes')) packs.add('funding_report'); // §3.4
  return [...packs];
}

// ============================================================================
// PREVIEW — what applyProvisioning() would change (returned by
// getProvisioningPreview; the Review step renders it verbatim).
// ============================================================================

export interface ProvisioningNavChange {
  label: string;
  href: string;
  visible: boolean;
}

/**
 * A storeroom row the apply step proposes to create — resolved from
 * storeroomPresetsFor(packs) in lib/industry-presets (type/temp defaults
 * come from lib/storerooms/room-types). `exists` = a same-named room
 * (case-insensitive) is already present and will be skipped on apply.
 * Kept structurally loose (string enums) so this file stays dependency-free.
 */
export interface ProvisioningStoreroomPreset {
  name: string;
  /** storerooms.type enum value (cold, frozen, dock, …). */
  type: string;
  type_label: string;
  description: string;
  temp_min: number | null;
  temp_max: number | null;
  access_level: string;
  quarantine: boolean;
  exists: boolean;
}

export interface ProvisioningPreview {
  /** Normalized config (packs derived) — what Apply would store. */
  config: Omit<ProvisioningConfig, 'applied_at'>;
  enabled_flags: FeatureFlag[];
  disabled_flags: FeatureFlag[];
  /** Feature-gated nav items and their resulting visibility. */
  nav: ProvisioningNavChange[];
  report_packs: ReportPackId[];
  /** Storerooms the apply step will create (skipped when `exists`). */
  storeroom_presets: ProvisioningStoreroomPreset[];
}

/** applyProvisioning() result — the stored config plus what it seeded. */
export interface ApplyProvisioningResult {
  config: ProvisioningConfig;
  /** Names of storerooms created by this apply (pack-derived presets). */
  storerooms_created: string[];
  /** Preset names skipped because a same-named room already existed. */
  storerooms_skipped: string[];
}

// ============================================================================
// CLIENT FLAG CACHE — populated by the dashboard layout once per session
// (getFeatureFlags server action). `visibleNavItems` reads it so the
// sidebar needs no prop drilling. null = unprovisioned/unknown → all on.
// ============================================================================

let clientFeatures: ReadonlySet<FeatureFlag> | null = null;

export function setClientFeatures(flags: readonly FeatureFlag[] | null): void {
  clientFeatures = flags ? new Set(flags) : null;
}

export function getClientFeatures(): ReadonlySet<FeatureFlag> | null {
  return clientFeatures;
}

/**
 * Is `flag` on? `enabled` semantics:
 *   undefined → the client flag cache (components that didn't fetch flags)
 *   null      → unprovisioned → everything on
 *   set/array → explicit flag list (server-side callers, tests)
 */
export function isFeatureEnabled(
  flag: FeatureFlag,
  enabled?: ReadonlySet<FeatureFlag> | readonly FeatureFlag[] | null,
): boolean {
  const set =
    enabled === undefined
      ? clientFeatures
      : enabled === null
        ? null
        : enabled instanceof Set
          ? enabled
          : new Set(enabled);
  if (!set) return true; // unprovisioned / not yet loaded → template shows all
  return set.has(flag);
}
