/**
 * lib/industry-presets — the "industry packs" depth layer:
 *
 *   PRESET_DEFINITIONS      — one-click wizard presets ("Pharmacy", "Tool
 *                             Library", …). A preset is a complete
 *                             ProvisioningInput (industries + stock
 *                             declarations + policies) that prefills every
 *                             wizard answer; the user may edit freely after.
 *                             (MASTER_EXECUTION_PROMPT item 383.)
 *
 *   storeroomPresetsFor(p)  — the storeroom shape each capability pack
 *                             proposes (item 85 + per-industry defaults).
 *                             Consumed by getProvisioningPreview (proposed
 *                             list) and applyProvisioning (creates missing
 *                             rooms, skipping same-named ones).
 *
 * PURE + edge-safe like lib/features.ts: constants and pure functions only,
 * safe to import from client components. Room-type defaults (temp bands,
 * toggles) come from lib/storerooms/room-types — the single source for
 * what a "cold" or "quarantine" room means; presets only supply the name,
 * type and access posture. Requirements trace to
 * docs/research/04-industry-verticals.md (M-priority) — see
 * docs/INDUSTRY-PACKS.md for the full matrix.
 */

import {
  PACKS,
  type IndustryId,
  type PackId,
  type ProvisioningInput,
  type ProvisioningPolicies,
  type StockCharacteristics,
} from '@/lib/features';
import {
  getRoomTypeDefaults,
  roomTypeLabel,
  type RoomAccessLevel,
  type RoomType,
} from '@/lib/storerooms/room-types';

// ============================================================================
// STOREROOM PRESETS — declarative rooms proposed per pack. Fields left
// undefined fall back to getRoomTypeDefaults(type) at resolve time.
// ============================================================================

export interface StoreroomPresetDef {
  /** Unique-ish display name — dedupe + idempotent-skip key (case-insensitive). */
  name: string;
  type: RoomType;
  description: string;
  access_level?: RoomAccessLevel;
  temp_min?: number | null;
  temp_max?: number | null;
  /** Sparse overlay on the room type's default feature toggles. */
  feature_toggles?: Record<string, boolean>;
  quarantine?: boolean;
}

/** Fully resolved room row — what the preview shows and apply inserts. */
export interface ResolvedStoreroomPreset {
  name: string;
  type: RoomType;
  type_label: string;
  description: string;
  temp_min: number | null;
  temp_max: number | null;
  access_level: RoomAccessLevel;
  allowed_roles: string[];
  feature_toggles: Record<string, boolean>;
  quarantine: boolean;
}

/**
 * Default allowed_roles per access level — mirrors the seed convention
 * (seed.sql storerooms): open rooms list everyone, restricted rooms the
 * builder roles, secure/locked rooms admins only. An empty array means
 * "all roles" in the room UI; presets stay explicit so the proposed
 * posture is visible in the review step.
 */
const ACCESS_ROLE_DEFAULTS: Record<RoomAccessLevel, readonly string[]> = {
  open: ['super_admin', 'admin', 'manager', 'staff', 'fleet_dispatch'],
  restricted: ['super_admin', 'admin', 'manager'],
  secure: ['super_admin', 'admin'],
  locked: ['super_admin', 'admin'],
};

const PACK_STOREROOM_PRESETS: Record<PackId, readonly StoreroomPresetDef[]> = {
  // Baseline stock flow: receive → stage → store → returns.
  stock_control: [
    {
      name: 'Main Store',
      type: 'general',
      description: 'Primary general storeroom',
      access_level: 'open',
    },
    {
      name: 'Staging Area',
      type: 'staging',
      description: 'Inbound/outbound staging before putaway',
      access_level: 'open',
    },
    {
      // Returns re-entering sellable stock needs a hold point (§7.3, item 147).
      name: 'Returns Holding',
      type: 'returns',
      description: 'Returned stock awaiting disposition',
      access_level: 'restricted',
    },
  ],
  // Shelf-stable perishables sit ambient; expired stock gets a hold room.
  perishables: [
    {
      name: 'Ambient Store',
      type: 'dry',
      description: 'Shelf-stable goods at controlled ambient (15–25 °C)',
      access_level: 'open',
    },
    {
      name: 'Expiry Hold',
      type: 'quarantine',
      description: 'Expired / rejected goods pending disposition (§9.3)',
      access_level: 'restricted',
    },
  ],
  // QC release gating + secure storage for regulated stock (§1.5, §4.1).
  regulated_items: [
    {
      name: 'Quarantine Room',
      type: 'quarantine',
      description: 'QC hold — release required before picking',
      access_level: 'restricted',
    },
    {
      name: 'Secure Store',
      type: 'secure',
      description: 'Regulated / high-value items — controlled access',
      access_level: 'secure',
    },
  ],
  // Temperature-controlled zones: pharma 2–8 °C band, frozen −18 °C,
  // plus a goods-in dock where delivery temps get verified (§1.7, §9.3).
  cold_chain: [
    {
      name: 'Cold Store 2–8 °C',
      type: 'cold',
      description: 'Chilled goods — vaccines, pharma, fresh food',
      access_level: 'restricted',
    },
    {
      name: 'Freezer −18 °C',
      type: 'frozen',
      description: 'Deep-frozen goods (−25…−15 °C operating band)',
      access_level: 'restricted',
    },
    {
      name: 'Receiving Dock',
      type: 'dock',
      description: 'Goods-in — delivery temperature verification point',
      access_level: 'open',
    },
  ],
  fleet_parts: [
    {
      name: 'Parts Store',
      type: 'general',
      description: 'Fleet parts storeroom',
      access_level: 'open',
    },
    {
      // Vehicles/vans are stock locations too — custody axis (§5.4).
      name: 'Vehicle Bay',
      type: 'vehicle',
      description: 'Stock held on vehicles / mobile units',
      access_level: 'restricted',
    },
  ],
  tool_crib: [
    {
      name: 'Tool Crib',
      type: 'secure',
      description: 'Loanable tools — checkout/return custody point',
      access_level: 'restricted',
    },
  ],
  industrial_stock: [
    {
      name: 'Bulk Store',
      type: 'general',
      description: 'Raw material and bulk MRO stock',
      access_level: 'open',
    },
    {
      name: 'Hazmat Store',
      type: 'hazmat',
      description: 'Chemicals and regulated material — segregated',
      access_level: 'restricted',
    },
  ],
  asset_issue: [
    {
      // IT/issue room fits schools+gov issuing laptops and devices;
      // secure default gives access control + door/motion monitoring.
      name: 'Asset Issue Room',
      type: 'it',
      description: 'Issuable assets — devices, equipment, kits',
      access_level: 'secure',
    },
  ],
};

/**
 * The storerooms a pack set proposes, resolved against the room-type
 * defaults. Deterministic: rooms follow the canonical PACKS order and are
 * de-duplicated by name (first pack wins) so multi-pack selections never
 * propose the same room twice.
 */
export function storeroomPresetsFor(
  packs: readonly PackId[],
): ResolvedStoreroomPreset[] {
  const packSet = new Set<PackId>(packs);
  const seen = new Set<string>();
  const out: ResolvedStoreroomPreset[] = [];

  // Iterate the canonical PACKS order; only packs present contribute.
  for (const pack of PACKS) {
    if (!packSet.has(pack)) continue;
    for (const def of PACK_STOREROOM_PRESETS[pack]) {
      const key = def.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const d = getRoomTypeDefaults(def.type);
      const access = def.access_level ?? d.access_level;
      out.push({
        name: def.name,
        type: def.type,
        type_label: roomTypeLabel(def.type),
        description: def.description,
        temp_min: def.temp_min !== undefined ? def.temp_min : d.temp_min,
        temp_max: def.temp_max !== undefined ? def.temp_max : d.temp_max,
        access_level: access,
        allowed_roles: [...ACCESS_ROLE_DEFAULTS[access]],
        feature_toggles: {
          ...d.feature_toggles,
          ...(def.feature_toggles ?? {}),
        },
        quarantine: def.quarantine ?? d.quarantine,
      });
    }
  }
  return out;
}

// ============================================================================
// PRESET TEMPLATES (item 383) — named one-click provisioning answer-sets.
// The wizard renders these on the industry step; selecting one prefills
// industries + stock + policies. Storerooms follow automatically from the
// packs the selection derives — no separate per-preset room list.
// ============================================================================

export const PRESET_IDS = [
  'general_inventory',
  'pharmacy',
  'tool_library',
  'fleet_parts_depot',
  'cold_storage',
  'school',
] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export interface IndustryPreset {
  id: PresetId;
  label: string;
  /** One-line summary shown under the preset name in the wizard. */
  description: string;
  industries: IndustryId[];
  stock: StockCharacteristics;
  policies: ProvisioningPolicies;
}

const NO_STOCK: StockCharacteristics = {
  perishable: false,
  temperature_sensitive: false,
  serialized: false,
  hazmat: false,
  tools_loanable: false,
  vehicle_parts: false,
  consumables: false,
};

const DEFAULT_PRESET_POLICIES: ProvisioningPolicies = {
  picking_strategy: 'fifo',
  picking_enforcement: 'suggest',
  valuation_method: 'weighted_average',
  expiry_policy: 'none',
};

export const PRESET_DEFINITIONS: readonly IndustryPreset[] = [
  {
    id: 'general_inventory',
    label: 'General Inventory',
    description:
      'Plain stock control — catalog, bins, counts. The smallest honest setup.',
    industries: ['general_retail'],
    stock: { ...NO_STOCK, consumables: true },
    policies: { ...DEFAULT_PRESET_POLICIES },
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    description:
      'DSCSA-style discipline: serialized lots, FEFO blocking, quarantine, ' +
      '2–8 °C cold rooms and secure storage.',
    industries: ['pharma_medical'],
    stock: {
      ...NO_STOCK,
      perishable: true,
      temperature_sensitive: true,
      serialized: true,
      consumables: true,
    },
    policies: {
      picking_strategy: 'fefo',
      // Release gates must actually block (§1.5 quarantine→release, §1.4
      // serial verification) — 'warn' would let off-policy picks through.
      picking_enforcement: 'block',
      valuation_method: 'weighted_average',
      expiry_policy: 'enforce_fefo_quarantine',
    },
  },
  {
    id: 'tool_library',
    label: 'Tool Library',
    description:
      'Custody tracking for loanable equipment — checkout/return, no stock ' +
      'counts or expiry ceremony.',
    industries: ['tools_equipment'],
    stock: {
      ...NO_STOCK,
      serialized: true,
      tools_loanable: true,
    },
    policies: { ...DEFAULT_PRESET_POLICIES },
  },
  {
    id: 'fleet_parts_depot',
    label: 'Fleet Parts',
    description:
      'Vehicle maintenance stock: parts with work-order references, ' +
      'consumables, tracked assets and a tool crib.',
    industries: ['automotive_fleet'],
    stock: {
      ...NO_STOCK,
      serialized: true,
      tools_loanable: true,
      vehicle_parts: true,
      consumables: true,
    },
    policies: {
      ...DEFAULT_PRESET_POLICIES,
      // Fluids/tyres age — record expiry, don't hard-block issues.
      expiry_policy: 'track',
    },
  },
  {
    id: 'cold_storage',
    label: 'Cold Storage',
    description:
      'Chilled + frozen food storage: FEFO rotation, excursion-quarantine ' +
      'expiry policy, cold/frozen rooms and a receiving dock.',
    industries: ['food_beverage'],
    stock: {
      ...NO_STOCK,
      perishable: true,
      temperature_sensitive: true,
      consumables: true,
    },
    policies: {
      picking_strategy: 'fefo',
      // FEFO enforced but overrideable with a recorded warning — the
      // documented override path (FEFO overrides must be auditable).
      picking_enforcement: 'warn',
      valuation_method: 'weighted_average',
      expiry_policy: 'enforce_fefo_quarantine',
    },
  },
  {
    id: 'school',
    label: 'School',
    description:
      'Education issue desk: laptops and equipment on loan, consumable ' +
      'supplies, lifecycle and funding-source tracking.',
    industries: ['government_education'],
    stock: {
      ...NO_STOCK,
      serialized: true,
      tools_loanable: true,
      consumables: true,
    },
    policies: { ...DEFAULT_PRESET_POLICIES },
  },
];

/** Look up a preset by id (the wizard stores the picked id only client-side). */
export function presetById(id: PresetId): IndustryPreset {
  const preset = PRESET_DEFINITIONS.find((p) => p.id === id);
  if (!preset) throw new Error(`Unknown preset: ${id}`);
  return preset;
}

/** The provisioning input a preset encodes — straight to the wizard state. */
export function presetProvisioningInput(preset: IndustryPreset): ProvisioningInput {
  return {
    industries: [...preset.industries],
    stock: { ...preset.stock },
    policies: { ...preset.policies },
  };
}
