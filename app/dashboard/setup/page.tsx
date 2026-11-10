'use client';

/**
 * /dashboard/setup — provisioning wizard (builder persona only, enforced
 * by ROUTE_ACCESS in lib/persona.ts + middleware).
 *
 * Steps: Industry → What you stock → Stock policies → Review & apply.
 * The Review step renders getProvisioningPreview() — a server-computed
 * diff of flags/nav/report packs — and Apply writes via
 * applyProvisioning(). Re-running the wizard pre-fills from the stored
 * config. Disabling a feature hides UI only; no data is ever deleted.
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
  packsForIndustries,
  type ExpiryPolicy,
  type IndustryId,
  type PickingEnforcement,
  type PickingStrategy,
  type ProvisioningInput,
  type ProvisioningPreview,
  type StockCharacteristics,
  type ValuationMethod,
} from '@/lib/features';

const STEPS = ['Industry', 'What you stock', 'Stock policies', 'Review & apply'] as const;

const EMPTY_STOCK: StockCharacteristics = {
  perishable: false,
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
  const [loading, setLoading] = useState(true);
  const [previouslyAppliedAt, setPreviouslyAppliedAt] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProvisioningPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input: ProvisioningInput = useMemo(
    () => ({ industries, stock, policies }),
    [industries, stock, policies],
  );

  const impliedPacks = useMemo(
    () => packsForIndustries(industries),
    [industries],
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
      setClientFeatures([...deriveFeatures(res.data)]);
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
      <div className="flex items-center gap-2 text-gray-500 p-8">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading setup…
      </div>
    );
  }

  if (applied) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <PackageCheck className="h-12 w-12 text-green-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Setup applied</h1>
          <p className="text-gray-600 mt-2">
            This instance is now configured. Menus, fields and report packs
            reflect your selections — nothing was deleted; re-run the wizard
            any time to change it.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to dashboard
            </Link>
            <button
              onClick={() => {
                setApplied(false);
                setStep(0);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
        <h1 className="text-2xl font-bold text-gray-900">Instance setup</h1>
        <p className="text-gray-600 mt-1">
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
                  ? 'bg-blue-600 text-white'
                  : i === step
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-600'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span
              className={`text-sm ${i === step ? 'font-medium text-gray-900' : 'text-gray-500'} hidden sm:inline`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-800">{error}</div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Which industries does this deployment serve?
            </h2>
            <p className="text-sm text-gray-600 mb-4">
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
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIndustry(id)}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {INDUSTRY_LABELS[id]}
                    </span>
                  </label>
                );
              })}
            </div>
            {impliedPacks.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Capability packs enabled
                </p>
                <div className="flex flex-wrap gap-2">
                  {impliedPacks.map((p) => (
                    <span
                      key={p}
                      className="px-2 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200"
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
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              What do you stock?
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              These characteristics turn on the matching fields and screens.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STOCK_CHARACTERISTICS.map((key) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    stock[key]
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={stock[key]}
                    onChange={() => toggleStock(key)}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {STOCK_CHARACTERISTIC_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Stock policies
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PICKING_STRATEGIES.map((v) => (
                    <option key={v} value={v}>
                      {PICKING_STRATEGY_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PICKING_ENFORCEMENTS.map((v) => (
                    <option key={v} value={v}>
                      {PICKING_ENFORCEMENT_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {VALUATION_METHODS.map((v) => (
                    <option key={v} value={v}>
                      {VALUATION_METHOD_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                Enforcing FEFO implies expiry tracking and FEFO picking —
                the corresponding features will be switched on automatically.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Review &amp; apply
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              This is exactly what changes. Disabling a feature hides its UI
              only — existing data is never deleted.
            </p>
            {previewLoading ? (
              <div className="flex items-center gap-2 text-gray-500 py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Computing…
              </div>
            ) : preview ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Features enabled
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {preview.enabled_flags.map((f) => (
                      <span
                        key={f}
                        className="px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 border border-green-200"
                      >
                        {FEATURE_FLAG_LABELS[f]}
                      </span>
                    ))}
                    {preview.disabled_flags.map((f) => (
                      <span
                        key={f}
                        className="px-2 py-1 text-xs rounded-full bg-gray-50 text-gray-500 border border-gray-200 line-through"
                      >
                        {FEATURE_FLAG_LABELS[f]}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Navigation
                  </h3>
                  <ul className="text-sm space-y-1">
                    {preview.nav.map((n) => (
                      <li key={n.href} className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${n.visible ? 'bg-green-500' : 'bg-gray-300'}`}
                        />
                        <span className={n.visible ? 'text-gray-900' : 'text-gray-500'}>
                          {n.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {n.visible ? 'shown' : 'hidden'}
                        </span>
                      </li>
                    ))}
                    <li className="text-xs text-gray-400 pt-1">
                      All other nav items are unaffected.
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Report packs
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {preview.report_packs.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                      >
                        {REPORT_PACK_LABELS[p]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
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
              <p className="text-sm text-gray-500 py-4">
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
          className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canContinue}
            className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleApply}
            disabled={applying || previewLoading || !preview}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying && <Loader2 className="h-4 w-4 animate-spin" />}
            {applying ? 'Applying…' : 'Apply configuration'}
          </button>
        )}
      </div>
    </div>
  );
}
