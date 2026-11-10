'use client';

/**
 * /dashboard/setup — provisioning wizard (builder persona only, enforced
 * by ROUTE_ACCESS in lib/persona.ts + middleware).
 *
 * Steps: Industry → What you stock → Stock policies → Review & apply.
 * Step 0 opens with one-click presets (lib/industry-presets) that prefill
 * every downstream answer — all fields stay editable afterwards.
 * The Review step renders getProvisioningPreview() — a server-computed
 * diff of flags/nav/report packs/storerooms — and Apply writes via
 * applyProvisioning(), which also creates the proposed storerooms
 * (same-named rooms are skipped). Re-running the wizard pre-fills from
 * the stored config. Disabling a feature hides UI only; no data is ever
 * deleted.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageCheck,
} from 'lucide-react';
import {
  applyProvisioning,
  getProvisioning,
  getProvisioningPreview,
} from '@/lib/actions/provisioning';
import {
  setClientFeatures,
  deriveFeatures,
  EXPIRY_POLICIES,
  EXPIRY_POLICY_LABELS,
  FEATURE_FLAG_LABELS,
  INDUSTRIES,
  INDUSTRY_LABELS,
  PACK_LABELS,
  PICKING_ENFORCEMENTS,
  PICKING_ENFORCEMENT_LABELS,
  PICKING_STRATEGIES,
  PICKING_STRATEGY_LABELS,
  REPORT_PACK_LABELS,
  STOCK_CHARACTERISTICS,
  STOCK_CHARACTERISTIC_LABELS,
  VALUATION_METHODS,
  VALUATION_METHOD_LABELS,
  packsForInput,
  type ExpiryPolicy,
  type IndustryId,
  type PickingEnforcement,
  type PickingStrategy,
  type ProvisioningInput,
  type ProvisioningPreview,
  type StockCharacteristics,
  type ValuationMethod,
} from '@/lib/features';
import {
  PRESET_DEFINITIONS,
  type IndustryPreset,
  type PresetId,
} from '@/lib/industry-presets';

const STEPS = ['Industry', 'What you stock', 'Stock policies', 'Review & apply'] as const;

const EMPTY_STOCK: StockCharacteristics = {
  perishable: false,
  temperature_sensitive: false,
  serialized: false,
  hazmat: false,
  tools_loanable: false,
  vehicle_parts: false,
  consumables: false,
};

const DEFAULT_POLICIES: ProvisioningInput['policies'] = {
  picking_strategy: 'fifo',
  picking_enforcement: 'suggest',
  valuation_method: 'weighted_average',
  expiry_policy: 'none',
};

export default function SetupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [industries, setIndustries] = useState<IndustryId[]>([]);
  const [stock, setStock] = useState<StockCharacteristics>(EMPTY_STOCK);
  const [policies, setPolicies] = useState<ProvisioningInput['policies']>(DEFAULT_POLICIES);
  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);
  const [loading, setLoading] = useState(true);
  const [previouslyAppliedAt, setPreviouslyAppliedAt] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProvisioningPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [createdRooms, setCreatedRooms] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const input: ProvisioningInput = useMemo(
    () => ({ industries, stock, policies }),
    [industries, stock, policies],
  );

  const impliedPacks = useMemo(
    () => packsForInput(industries, stock),
    [industries, stock],
  );

  // Pre-fill from the stored config when the wizard is re-run.
  useEffect(() => {
    let cancelled = false;
    getProvisioning()
      .then((res) => {
        if (cancelled) return;
        if (!res.success) {
          setError(res.error);
          return;
        }
        if (res.data) {
          setIndustries(res.data.industries);
          setStock({ ...EMPTY_STOCK, ...res.data.stock });
          setPolicies({ ...DEFAULT_POLICIES, ...res.data.policies });
          setPreviouslyAppliedAt(res.data.applied_at);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load provisioning config');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the server-computed diff when the Review step is reached.
  const loadPreview = useCallback(() => {
    setPreviewLoading(true);
    setError(null);
    getProvisioningPreview(input)
      .then((res) => {
        if (!res.success) {
          setError(res.error);
          setPreview(null);
          return;
        }
        setPreview(res.data);
      })
      .catch(() => setError('Failed to compute preview'))
      .finally(() => setPreviewLoading(false));
  }, [input]);

  useEffect(() => {
    if (step === 3 && !applied) loadPreview();
  }, [step, applied, loadPreview]);

  const toggleIndustry = (id: IndustryId) =>
    setIndustries((cur) =>
      cur.includes(id) ? cur.filter((i) => i !== id) : [...cur, id],
    );

  // A preset is just a pre-filled answer-set — every answer stays editable.
  const applyPresetAnswers = (preset: IndustryPreset) => {
    setSelectedPreset(preset.id);
    setIndustries([...preset.industries]);
    setStock({ ...EMPTY_STOCK, ...preset.stock });
    setPolicies({ ...DEFAULT_POLICIES, ...preset.policies });
  };

  const toggleStock = (key: keyof StockCharacteristics) =>
    setStock((cur) => ({ ...cur, [key]: !cur[key] }));

  const canContinue =
    step === 0 ? industries.length > 0 : true;

  const handleApply = async () => {
    setApplying(true);
    setError(null);
    try {
      const res = await applyProvisioning(input);
      if (!res.success) {
        setError(res.error);
        return;
      }
      // Publish the new flag set so nav/forms reflect it immediately
      // (visibleNavItems reads the client cache on next render).
      setClientFeatures([...deriveFeatures(res.data.config)]);
      setCreatedRooms(res.data.storerooms_created);
      setApplied(true);
      router.refresh();
    } catch {
      setError('Failed to apply configuration');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading setup…
      </div>
    );
  }

  if (applied) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-card rounded-lg border border-border shadow-sm p-8 text-center">
          <PackageCheck className="h-12 w-12 text-success mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Setup applied</h1>
          <p className="text-muted-foreground mt-2">
            This instance is now configured. Menus, fields and report packs
            reflect your selections — nothing was deleted; re-run the wizard
            any time to change it.
          </p>
          {createdRooms.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              Storerooms created: {createdRooms.join(' · ')}
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Go to dashboard
            </Link>
            <button
              onClick={() => {
                setApplied(false);
                setStep(0);
              }}
              className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
            >
              Re-run wizard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Instance setup</h1>
        <p className="text-muted-foreground mt-1">
          {previouslyAppliedAt
            ? `This instance was last configured ${new Date(previouslyAppliedAt).toLocaleString()} — your previous answers are pre-filled.`
            : 'Tell us what this deployment stocks and how it works — we enable the menus, fields and workflows to match.'}
        </p>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2 flex-1">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                i < step
                  ? 'bg-primary text-primary-foreground'
                  : i === step
                    ? 'bg-info/10 text-info ring-2 ring-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={`text-sm ${i === step ? 'font-medium text-foreground' : 'text-muted-foreground'} hidden sm:inline`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">{error}</div>
      )}

      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Start from a preset
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Optional — one click fills in every answer below. You can
              adjust anything afterwards.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              {PRESET_DEFINITIONS.map((preset) => {
                const active = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPresetAnswers(preset)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      active
                        ? 'border-primary bg-info/10'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <div className="text-sm font-medium text-foreground">
                      {preset.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {preset.description}
                    </div>
                  </button>
                );
              })}
            </div>

            <h2 className="text-lg font-semibold text-foreground mb-1">
              Which industries does this deployment serve?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Pick all that apply — each enables a set of capability packs.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INDUSTRIES.map((id) => {
                const checked = industries.includes(id);
                return (
                  <label
                    key={id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'border-primary bg-info/10'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIndustry(id)}
                      className="h-4 w-4 text-primary rounded"
                    />
                    <span className="text-sm font-medium text-foreground">
                      {INDUSTRY_LABELS[id]}
                    </span>
                  </label>
                );
              })}
            </div>
            {impliedPacks.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Capability packs enabled
                </p>
                <div className="flex flex-wrap gap-2">
                  {impliedPacks.map((p) => (
                    <span
                      key={p}
                      className="px-2 py-1 text-xs rounded-full bg-info/10 text-info border border-info/30"
                    >
                      {PACK_LABELS[p]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              What do you stock?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              These characteristics turn on the matching fields and screens.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STOCK_CHARACTERISTICS.map((key) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    stock[key]
                      ? 'border-primary bg-info/10'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={stock[key]}
                    onChange={() => toggleStock(key)}
                    className="h-4 w-4 text-primary rounded"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {STOCK_CHARACTERISTIC_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-foreground">
              Stock policies
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Picking strategy
                </label>
                <select
                  value={policies.picking_strategy}
                  onChange={(e) =>
                    setPolicies({
                      ...policies,
                      picking_strategy: e.target.value as PickingStrategy,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PICKING_STRATEGIES.map((v) => (
                    <option key={v} value={v}>
                      {PICKING_STRATEGY_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Picking enforcement
                </label>
                <select
                  value={policies.picking_enforcement}
                  onChange={(e) =>
                    setPolicies({
                      ...policies,
                      picking_enforcement: e.target
                        .value as PickingEnforcement,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PICKING_ENFORCEMENTS.map((v) => (
                    <option key={v} value={v}>
                      {PICKING_ENFORCEMENT_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Valuation method
                </label>
                <select
                  value={policies.valuation_method}
                  onChange={(e) =>
                    setPolicies({
                      ...policies,
                      valuation_method: e.target.value as ValuationMethod,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {VALUATION_METHODS.map((v) => (
                    <option key={v} value={v}>
                      {VALUATION_METHOD_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Expiry policy
                </label>
                <select
                  value={policies.expiry_policy}
                  onChange={(e) =>
                    setPolicies({
                      ...policies,
                      expiry_policy: e.target.value as ExpiryPolicy,
                    })
                  }
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {EXPIRY_POLICIES.map((v) => (
                    <option key={v} value={v}>
                      {EXPIRY_POLICY_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {(policies.expiry_policy === 'enforce_fefo' ||
              policies.expiry_policy === 'enforce_fefo_quarantine') && (
              <p className="text-sm text-warning bg-warning/10 border border-warning/30 rounded-lg p-3">
                Enforcing FEFO implies expiry tracking and FEFO picking —
                the corresponding features will be switched on automatically.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Review &amp; apply
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              This is exactly what changes. Disabling a feature hides its UI
              only — existing data is never deleted.
            </p>
            {previewLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Computing…
              </div>
            ) : preview ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Features enabled
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {preview.enabled_flags.map((f) => (
                      <span
                        key={f}
                        className="px-2 py-1 text-xs rounded-full bg-success/10 text-success border border-success/30"
                      >
                        {FEATURE_FLAG_LABELS[f]}
                      </span>
                    ))}
                    {preview.disabled_flags.map((f) => (
                      <span
                        key={f}
                        className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground border border-border line-through"
                      >
                        {FEATURE_FLAG_LABELS[f]}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Navigation
                  </h3>
                  <ul className="text-sm space-y-1">
                    {preview.nav.map((n) => (
                      <li key={n.href} className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${n.visible ? 'bg-success' : 'bg-input'}`}
                        />
                        <span className={n.visible ? 'text-foreground' : 'text-muted-foreground'}>
                          {n.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {n.visible ? 'shown' : 'hidden'}
                        </span>
                      </li>
                    ))}
                    <li className="text-xs text-muted-foreground pt-1">
                      All other nav items are unaffected.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Report packs
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {preview.report_packs.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/30"
                      >
                        {REPORT_PACK_LABELS[p]}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Storerooms
                  </h3>
                  {preview.storeroom_presets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No storerooms proposed for this selection.
                    </p>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {preview.storeroom_presets.map((r) => (
                        <li key={r.name} className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${r.exists ? 'bg-input' : 'bg-success'}`}
                          />
                          <span className={r.exists ? 'text-muted-foreground' : 'text-foreground'}>
                            {r.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.type_label}
                            {r.temp_min !== null && r.temp_max !== null
                              ? ` · ${r.temp_min}–${r.temp_max} °C`
                              : ''}
                            {' · '}
                            {r.exists ? 'already exists — kept as-is' : 'will be created'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                  <p>
                    <strong>Policies:</strong>{' '}
                    {PICKING_STRATEGY_LABELS[policies.picking_strategy]} ·{' '}
                    {PICKING_ENFORCEMENT_LABELS[policies.picking_enforcement]} ·{' '}
                    {VALUATION_METHOD_LABELS[policies.valuation_method]} ·{' '}
                    {EXPIRY_POLICY_LABELS[policies.expiry_policy]}
                  </p>
                  <p className="mt-1">
                    <strong>Packs:</strong>{' '}
                    {preview.config.packs.map((p) => PACK_LABELS[p]).join(' · ')}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Preview unavailable — check the error above.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue}
            className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleApply}
            disabled={applying || previewLoading || !preview}
            className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-lg hover:bg-success/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying && <Loader2 className="h-4 w-4 animate-spin" />}
            {applying ? 'Applying…' : 'Apply configuration'}
          </button>
        )}
      </div>
    </div>
  );
}
