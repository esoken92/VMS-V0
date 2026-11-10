'use client';

/**
 * /dashboard/scan — scan-first operator surface.
 *
 * Three capture channels, one pipeline:
 *   camera   html5-qrcode viewfinder (CameraScanner)
 *   hid      keyboard-wedge / USB-RFID burst capture (useHidWedge)
 *   manual   typed fallback — always surfaces a "manual entry logged" notice
 *
 * The status panel shows what was scanned, what it resolved to, and the
 * role-gated actions the server says are allowed. Scanning a bin sets the
 * station location for subsequent scans (location_context → velocity
 * anomaly detection).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeAlert,
  Camera,
  ClipboardList,
  Keyboard,
  MapPin,
  Package,
  Printer,
  QrCode,
  ScanLine,
  Wrench,
  X,
} from 'lucide-react';
import Link from 'next/link';
import {
  submitScan,
  scanQuickReceive,
  scanQuickIssue,
  scanToolToggle,
  scanJoinStockTake,
} from '@/lib/actions/scan';
import { startStockTake } from '@/lib/actions/stock-takes';
import { upsertProduct } from '@/lib/actions/products';
import { ITEM_TYPES } from '@/lib/auth/roles';
import type {
  ScanAction,
  ScanInputType,
  ScanResolutionDTO,
} from '@/lib/scan/types';
import { CameraScanner } from './camera-scanner';
import { useHidWedge } from './use-hid-wedge';

interface HistoryRow {
  code: string;
  label: string;
  input_type: ScanInputType;
  at: number;
  flagged: boolean;
}

const INPUT_TYPE_LABEL: Record<ScanInputType, string> = {
  camera: 'Camera',
  hid: 'Scanner',
  manual: 'Manual',
  rfid: 'RFID',
};

export default function ScanDashboardPage() {
  const [cameraOn, setCameraOn] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('');
  const [location, setLocation] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<ScanResolutionDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error' | 'warn'; text: string } | null>(null);
  const [qty, setQty] = useState(1);
  const [showCard, setShowCard] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    sku: '',
    name: '',
    item_type: 'consumable' as (typeof ITEM_TYPES)[number],
    unit_of_measure: 'ea',
    issuing_unit: 'ea',
  });
  const [history, setHistory] = useState<HistoryRow[]>([]);
  /** Raw scan payload echoing the current result — sent back on writes. */
  const lastRaw = useRef<{ code: string; input_type: ScanInputType } | null>(null);
  const busyRef = useRef(false);

  // Station tag persists per-browser.
  useEffect(() => {
    const saved = window.localStorage.getItem('vms-scan-device');
    if (saved) setDeviceLabel(saved);
  }, []);
  const saveDeviceLabel = (v: string) => {
    setDeviceLabel(v);
    try {
      window.localStorage.setItem('vms-scan-device', v);
    } catch {
      /* private mode */
    }
  };

  const pushHistory = (code: string, label: string, inputType: ScanInputType, flagged: boolean) =>
    setHistory((h) => [{ code, label, input_type: inputType, at: Date.now(), flagged }, ...h].slice(0, 8));

  const doScan = useCallback(
    async (code: string, inputType: ScanInputType) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setFlash(null);
      try {
        const res = await submitScan({
          code,
          input_type: inputType,
          device_label: deviceLabel || null,
          location_context: location,
        });
        if (!res.success) {
          setFlash({ type: 'error', text: res.error });
          return;
        }
        setResult(res.data);
        lastRaw.current = { code, input_type: inputType };
        setShowCreate(false);
        setShowCard(false);
        pushHistory(
          res.data.code,
          res.data.entity ? `${res.data.entity.type}: ${res.data.entity.label}` : 'Unresolved',
          inputType,
          !!res.data.flag_reason,
        );
        // Auto-adopt a scanned bin as the station location.
        if (res.data.ok && res.data.entity?.type === 'bin') {
          setLocation(res.data.entity.label);
          setFlash({ type: 'success', text: `Location set to ${res.data.entity.label}` });
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [deviceLabel, location],
  );

  useHidWedge((code) => void doScan(code, 'hid'), true);

  const submitManual = () => {
    const code = manualCode.trim();
    if (!code || busyRef.current) return;
    setManualCode('');
    void doScan(code, 'manual');
  };

  // ---- write actions -------------------------------------------------------

  const writeMeta = () => ({
    code: lastRaw.current?.code ?? result?.code ?? '',
    input_type: (lastRaw.current?.input_type ?? result?.input_type ?? 'manual') as ScanInputType,
    device_label: deviceLabel || null,
    location_context: location,
  });

  const runWrite = async (
    fn: () => Promise<{ success: true; data: { message: string; product?: ScanResolutionDTO['product']; active_loan?: ScanResolutionDTO['active_loan'] } } | { success: false; error: string }>,
  ) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.success) {
        setFlash({ type: 'error', text: res.error });
        return;
      }
      setFlash({ type: 'success', text: res.data.message });
      if (result && res.data.product) {
        setResult({ ...result, product: res.data.product, active_loan: res.data.active_loan ?? result.active_loan });
      }
    } finally {
      setBusy(false);
    }
  };

  const doReceive = () => {
    if (!result?.product) return;
    void runWrite(() =>
      scanQuickReceive({ product_id: result.product!.id, quantity: qty, ...writeMeta() }),
    );
  };
  const doIssue = () => {
    if (!result?.product) return;
    void runWrite(() =>
      scanQuickIssue({ product_id: result.product!.id, quantity: qty, ...writeMeta() }),
    );
  };
  const doToolToggle = () => {
    if (!result?.product) return;
    void runWrite(() =>
      scanToolToggle({ product_id: result.product!.id, ...writeMeta() }),
    );
  };
  const doJoinTake = () => {
    if (!result?.stock_take) return;
    void runWrite(() =>
      scanJoinStockTake({ stock_take_id: result.stock_take!.id, ...writeMeta() }),
    );
  };
  const doStartTake = async () => {
    setBusy(true);
    try {
      const res = await startStockTake({ notes: 'Started from scan station' });
      if (!res.success) {
        setFlash({ type: 'error', text: res.error });
      } else {
        setFlash({ type: 'success', text: 'Stock take started — find it on the Stock Takes page' });
      }
    } finally {
      setBusy(false);
    }
  };

  const doCreateProduct = async () => {
    setBusy(true);
    try {
      const res = await upsertProduct({
        sku: createForm.sku.trim(),
        name: createForm.name.trim(),
        item_type: createForm.item_type,
        unit_of_measure: createForm.unit_of_measure.trim() || 'ea',
        issuing_unit: createForm.issuing_unit.trim() || 'ea',
        min_threshold: 0,
        average_cost: 0,
      });
      if (!res.success) {
        setFlash({ type: 'error', text: res.error });
        return;
      }
      setShowCreate(false);
      setFlash({ type: 'success', text: `Created ${res.data.sku} — rescanning` });
      // Re-resolve so the panel fills with the fresh product.
      if (lastRaw.current) void doScan(lastRaw.current.code, lastRaw.current.input_type);
    } finally {
      setBusy(false);
    }
  };

  // ---- render --------------------------------------------------------------

  const flagText: Record<string, string> = {
    impossible_velocity: 'Flagged: same item scanned at a different location within 60s',
    rate_limited: 'Flagged: manual entry rate limit hit',
    bad_checksum: 'Flagged: bad code checksum',
    token_expired: 'Flagged: expired label token',
    token_bad_signature: 'Flagged: invalid label signature',
    token_consumed: 'Flagged: rotated/superseded label',
    token_unknown: 'Flagged: unrecognized label token',
  };

  const has = (a: ScanAction) => result?.allowed_actions.includes(a) ?? false;

  return (
    <div className="-m-6 min-h-[calc(100vh-4rem)] bg-gray-900 text-gray-100">
      <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
        {/* header strip */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-emerald-400" />
            <h1 className="text-xl font-bold">Scan Station</h1>
          </div>
          <div className="flex-1" />
          <input
            value={deviceLabel}
            onChange={(e) => saveDeviceLabel(e.target.value)}
            placeholder="Device label (e.g. bay-2)"
            className="w-44 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {location ? (
            <span className="flex items-center gap-1.5 rounded-lg bg-emerald-900/60 border border-emerald-700 px-3 py-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-emerald-400" />
              {location}
              <button
                onClick={() => setLocation(null)}
                className="ml-1 text-emerald-300 hover:text-white"
                aria-label="Clear location"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-gray-400">
              <MapPin className="h-4 w-4" />
              No location — scan a bin
            </span>
          )}
          <button
            onClick={() => setCameraOn((v) => !v)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              cameraOn ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            <Camera className="h-4 w-4" />
            {cameraOn ? 'Camera on' : 'Use camera'}
          </button>
        </div>

        {/* flash */}
        {flash && (
          <div
            className={`rounded-lg px-4 py-3 text-sm font-medium ${
              flash.type === 'success'
                ? 'bg-emerald-900/50 text-emerald-200 border border-emerald-800'
                : flash.type === 'warn'
                  ? 'bg-amber-900/50 text-amber-200 border border-amber-800'
                  : 'bg-red-900/50 text-red-200 border border-red-800'
            }`}
          >
            {flash.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* left — capture surface */}
          <div className="space-y-4">
            {cameraOn ? (
              <CameraScanner
                active={cameraOn}
                onScan={(code) => void doScan(code, 'camera')}
                onError={(msg) => {
                  setFlash({ type: 'error', text: msg });
                  setCameraOn(false);
                }}
              />
            ) : (
              <div className="relative w-full aspect-square max-h-[52vh] bg-gray-800/60 rounded-2xl border-2 border-dashed border-gray-700 flex flex-col items-center justify-center gap-4">
                <QrCode className={`h-20 w-20 ${busy ? 'text-emerald-400 animate-pulse' : 'text-gray-600'}`} />
                <p className="text-lg font-medium text-gray-300">
                  {busy ? 'Resolving…' : 'Ready to scan'}
                </p>
                <p className="text-sm text-gray-500 text-center px-8">
                  Aim a USB/Bluetooth scanner at this window, enable the
                  camera, or type a code below.
                </p>
              </div>
            )}

            {/* manual entry */}
            <div className="rounded-2xl bg-gray-800/60 border border-gray-700 p-4 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Keyboard className="h-4 w-4" />
                Manual entry
              </label>
              <div className="flex gap-2">
                <input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                  placeholder="TYPE:ID or SKU…"
                  className="flex-1 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-sm font-mono placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={submitManual}
                  disabled={busy || !manualCode.trim()}
                  className="rounded-lg bg-gray-700 px-4 py-2.5 text-sm font-medium hover:bg-gray-600 disabled:opacity-40 transition-colors"
                >
                  Log entry
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Manual entries are rate-limited and every one is logged.
              </p>
            </div>

            {/* history strip */}
            {history.length > 0 && (
              <div className="rounded-2xl bg-gray-800/40 border border-gray-800 p-3">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Recent scans</p>
                <ul className="space-y-1">
                  {history.map((h, i) => (
                    <li key={`${h.at}-${i}`} className="flex items-center gap-2 text-xs text-gray-400">
                      {h.flagged && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                      <span className="text-gray-500">{INPUT_TYPE_LABEL[h.input_type]}</span>
                      <span className="font-mono truncate">{h.label}</span>
                      <span className="ml-auto text-gray-600">
                        {new Date(h.at).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* right — status panel */}
          <div className="rounded-2xl bg-gray-800/60 border border-gray-700 p-5 space-y-4 min-h-[24rem]">
            {!result ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-gray-500">
                <ScanLine className="h-10 w-10" />
                <p className="font-medium">No scan yet</p>
                <p className="text-sm">The last scanned code and what it resolved to will appear here.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest text-gray-500">
                    {INPUT_TYPE_LABEL[result.input_type]} scan
                  </p>
                  {result.scan_event_id && (
                    <p className="text-xs text-gray-600 font-mono">#{result.scan_event_id.slice(0, 8)}</p>
                  )}
                </div>

                {result.manual_logged && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-900/50 border border-amber-700 px-3 py-2 text-sm text-amber-200">
                    <BadgeAlert className="h-4 w-4 shrink-0" />
                    Manual entry logged
                  </div>
                )}

                {result.flag_reason && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-900/50 border border-amber-700 px-3 py-2 text-sm text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {flagText[result.flag_reason] ?? `Flagged: ${result.flag_reason}`}
                  </div>
                )}

                {!result.ok ? (
                  <div className="rounded-xl bg-red-900/40 border border-red-800 p-4">
                    <p className="font-semibold text-red-200">Scan failed</p>
                    <p className="text-sm text-red-300 mt-1">{result.error}</p>
                    <p className="mt-3 font-mono text-xs text-gray-500 break-all">{result.code}</p>
                  </div>
                ) : result.entity ? (
                  <div className="rounded-xl bg-gray-900/70 border border-gray-700 p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-lg bg-emerald-900/60">
                        {result.entity.type === 'tool' ? (
                          <Wrench className="h-6 w-6 text-emerald-400" />
                        ) : result.entity.type === 'bin' ? (
                          <MapPin className="h-6 w-6 text-emerald-400" />
                        ) : result.entity.type === 'take' ? (
                          <ClipboardList className="h-6 w-6 text-emerald-400" />
                        ) : (
                          <Package className="h-6 w-6 text-emerald-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-emerald-400 font-medium">
                          {result.entity.type === 'take' ? 'Stock take' : result.entity.type}
                        </p>
                        <p className="text-2xl font-bold leading-tight">{result.entity.label}</p>
                      </div>
                    </div>
                    {result.entity.detail && <p className="text-sm text-gray-400">{result.entity.detail}</p>}

                    {result.product && (
                      <div className="grid grid-cols-2 gap-2 text-sm pt-1">
                        <div className="rounded-lg bg-gray-800/80 p-3">
                          <p className="text-xs text-gray-500">On hand</p>
                          <p className="text-lg font-semibold">
                            {result.product.current_stock}{' '}
                            <span className="text-sm font-normal text-gray-400">{result.product.unit_of_measure}</span>
                          </p>
                        </div>
                        <div className="rounded-lg bg-gray-800/80 p-3">
                          <p className="text-xs text-gray-500">Bin</p>
                          <p className="text-lg font-semibold">
                            {result.product_bin ? `${result.product_bin.zone}-${result.product_bin.bin_location}` : '—'}
                          </p>
                        </div>
                      </div>
                    )}

                    {result.active_loan && (
                      <p className="text-sm text-amber-300">
                        On loan to {result.active_loan.worker_name ?? 'someone'}
                        {result.active_loan.checked_out_at
                          ? ` since ${new Date(result.active_loan.checked_out_at).toLocaleString()}`
                          : ''}
                      </p>
                    )}

                    {/* allowed actions */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {has('view') && result.product && (
                        <button
                          onClick={() => setShowCard(true)}
                          className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-600 transition-colors"
                        >
                          View card
                        </button>
                      )}
                      {has('receive') && (
                        <button
                          onClick={doReceive}
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                        >
                          <ArrowDownToLine className="h-4 w-4" /> Receive
                        </button>
                      )}
                      {has('issue') && (
                        <button
                          onClick={doIssue}
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium hover:bg-orange-500 disabled:opacity-40 transition-colors"
                        >
                          <ArrowUpFromLine className="h-4 w-4" /> Issue
                        </button>
                      )}
                      {has('tool_toggle') && (
                        <button
                          onClick={doToolToggle}
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                        >
                          <Wrench className="h-4 w-4" />
                          {result.active_loan ? 'Return tool' : 'Check out'}
                        </button>
                      )}
                      {has('join_take') && (
                        <button
                          onClick={doJoinTake}
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                        >
                          <ClipboardList className="h-4 w-4" /> Join stock take
                        </button>
                      )}
                      {result.entity.type === 'bin' && has('set_location') && (
                        <button
                          onClick={() => {
                            setLocation(result.entity!.label);
                            setFlash({ type: 'success', text: `Location set to ${result.entity!.label}` });
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 transition-colors"
                        >
                          <MapPin className="h-4 w-4" /> Set as location
                        </button>
                      )}
                      {(result.entity.type === 'product' ||
                        result.entity.type === 'bin' ||
                        result.entity.type === 'take' ||
                        result.entity.type === 'tool') && (
                        <a
                          href={`/api/labels/${result.entity.type}/${result.entity.id}.svg`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium hover:bg-gray-600 transition-colors"
                        >
                          <Printer className="h-4 w-4" /> Label
                        </a>
                      )}
                    </div>

                    {(has('receive') || has('issue')) && (
                      <div className="flex items-center gap-2 pt-1">
                        <label className="text-xs text-gray-500">Qty</label>
                        <input
                          type="number"
                          min={0.01}
                          step="0.01"
                          value={qty}
                          onChange={(e) => setQty(Math.max(0.01, Number(e.target.value) || 1))}
                          className="w-24 rounded-lg bg-gray-900 border border-gray-700 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  /* unresolved */
                  <div className="rounded-xl bg-gray-900/70 border border-gray-700 p-5 space-y-3">
                    <p className="font-semibold text-gray-200">Unrecognized code</p>
                    <p className="font-mono text-sm text-gray-400 break-all">{result.code}</p>
                    {has('create_product') ? (
                      <button
                        onClick={() => {
                          setCreateForm((f) => ({ ...f, sku: result.suggested_sku ?? result.code }));
                          setShowCreate(true);
                        }}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 transition-colors"
                      >
                        Create product “{result.suggested_sku}”
                      </button>
                    ) : (
                      <p className="text-sm text-gray-500">No matching product, bin, take or tool.</p>
                    )}
                  </div>
                )}

                {result.stock_take && (
                  <Link
                    href="/dashboard/stock-takes"
                    className="inline-flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200"
                  >
                    Open Stock Takes page →
                  </Link>
                )}
              </>
            )}

            <div className="pt-2 border-t border-gray-800">
              <button
                onClick={() => void doStartTake()}
                disabled={busy}
                className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-40"
              >
                + Start a new stock take
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* product card overlay */}
      {showCard && result?.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-gray-800 border border-gray-700 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-400">
                  {result.product.item_type}
                </p>
                <h2 className="text-2xl font-bold">{result.product.sku}</h2>
                <p className="text-gray-400">{result.product.name}</p>
              </div>
              <button onClick={() => setShowCard(false)} className="text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-gray-900/70 p-3">
                <dt className="text-xs text-gray-500">On hand</dt>
                <dd className="text-xl font-semibold">
                  {result.product.current_stock} {result.product.unit_of_measure}
                </dd>
              </div>
              <div className="rounded-lg bg-gray-900/70 p-3">
                <dt className="text-xs text-gray-500">Min threshold</dt>
                <dd className="text-xl font-semibold">{result.product.min_threshold}</dd>
              </div>
              <div className="rounded-lg bg-gray-900/70 p-3">
                <dt className="text-xs text-gray-500">Avg cost</dt>
                <dd className="text-xl font-semibold">{result.product.average_cost}</dd>
              </div>
              <div className="rounded-lg bg-gray-900/70 p-3">
                <dt className="text-xs text-gray-500">Bin</dt>
                <dd className="text-xl font-semibold">
                  {result.product_bin ? `${result.product_bin.zone}-${result.product_bin.bin_location}` : '—'}
                </dd>
              </div>
            </dl>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={qty}
                onChange={(e) => setQty(Math.max(0.01, Number(e.target.value) || 1))}
                className="w-24 rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {has('receive') && (
                <button
                  onClick={doReceive}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
                >
                  Receive {qty}
                </button>
              )}
              {has('issue') && (
                <button
                  onClick={doIssue}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium hover:bg-orange-500 disabled:opacity-40"
                >
                  Issue {qty}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* create-product prefill modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-gray-800 border border-gray-700 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold">New product from scan</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">SKU</label>
                <input
                  value={createForm.sku}
                  onChange={(e) => setCreateForm({ ...createForm, sku: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Name</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Type</label>
                  <select
                    value={createForm.item_type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, item_type: e.target.value as (typeof ITEM_TYPES)[number] })
                    }
                    className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Unit</label>
                  <input
                    value={createForm.unit_of_measure}
                    onChange={(e) => setCreateForm({ ...createForm, unit_of_measure: e.target.value })}
                    className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Issuing unit</label>
                  <input
                    value={createForm.issuing_unit}
                    onChange={(e) => setCreateForm({ ...createForm, issuing_unit: e.target.value })}
                    className="mt-1 w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={() => void doCreateProduct()}
              disabled={busy || !createForm.sku.trim() || !createForm.name.trim()}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40 transition-colors"
            >
              Create product
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
