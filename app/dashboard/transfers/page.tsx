'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Boxes,
  Check,
  Eye,
  MoveRight,
  Package,
  Plus,
  Search,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { can } from '@/lib/auth/permissions';
import {
  cancelTransfer,
  createTransfer,
  dispatchTransfer,
  getTransferItems,
  listBinStock,
  listTransfers,
  moveAllBinContents,
  receiveTransfer,
} from '@/lib/actions/transfers';
import { assembleKit, disassembleKit, getKitComponents, listKits, setKitComponents } from '@/lib/actions/kits';
import { listBinLocations } from '@/lib/actions/bin-locations';
import { listProducts } from '@/lib/actions/products';
import type {
  BinLocationDTO,
  BinStockDTO,
  KitComponentDTO,
  KitDTO,
  ProductDTO,
  TransferDTO,
  TransferItemDTO,
} from '@/lib/types';

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  dispatched: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  received: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
};

interface DraftItem {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  max: number;
}

export default function TransfersPage() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'staff';
  const [transfers, setTransfers] = useState<TransferDTO[]>([]);
  const [bins, setBins] = useState<BinLocationDTO[]>([]);
  const [kits, setKits] = useState<KitDTO[]>([]);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showMoveAll, setShowMoveAll] = useState(false);
  const [viewing, setViewing] = useState<TransferDTO | null>(null);
  const [viewItems, setViewItems] = useState<TransferItemDTO[]>([]);

  const [fromBin, setFromBin] = useState('');
  const [toBin, setToBin] = useState('');
  const [notes, setNotes] = useState('');
  const [binStock, setBinStock] = useState<BinStockDTO[]>([]);
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [pickId, setPickId] = useState('');

  const [moveFrom, setMoveFrom] = useState('');
  const [moveTo, setMoveTo] = useState('');

  const [editKit, setEditKit] = useState<KitDTO | null>(null);
  const [bom, setBom] = useState<KitComponentDTO[]>([]);
  const [bomPick, setBomPick] = useState('');

  const canCreate = can(role, 'transfers:create');
  const canDispatch = can(role, 'transfers:dispatch');
  const canReceive = can(role, 'transfers:receive');
  const canCancel = can(role, 'transfers:cancel');
  const canAssemble = can(role, 'kits:assemble');
  const canEditBom = can(role, 'kits:write');

  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    try {
      const [t, b, k, p] = await Promise.all([
        listTransfers(),
        listBinLocations(),
        listKits(),
        listProducts(),
      ]);
      if (!t.success) throw new Error(t.error);
      setTransfers(t.data);
      if (b.success) setBins(b.data);
      if (k.success) setKits(k.data);
      if (p.success) setProducts(p.data);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load transfers' });
    } finally {
      setLoading(false);
    }
  };

  const withBusy = async (fn: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const filtered = transfers.filter((t) =>
    `${t.transfer_number} ${t.from_bin_label} ${t.to_bin_label}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  /* ---------- create form ---------- */
  const openCreate = () => {
    setFromBin('');
    setToBin('');
    setNotes('');
    setDraftItems([]);
    setBinStock([]);
    setPickId('');
    setShowCreate(true);
  };

  useEffect(() => {
    if (!fromBin) return setBinStock([]);
    void listBinStock(fromBin).then((r) => {
      if (r.success) setBinStock(r.data);
    });
  }, [fromBin]);

  const addDraftItem = (pid: string) => {
    const s = binStock.find((x) => x.product_id === pid);
    if (!s || draftItems.some((d) => d.product_id === pid)) return;
    setDraftItems([
      ...draftItems,
      { product_id: pid, sku: s.product_sku ?? '', name: s.product_name ?? '', unit: s.product_unit ?? 'pcs', quantity: 1, max: s.quantity },
    ]);
    setPickId('');
  };

  const submitCreate = () =>
    withBusy(async () => {
      const r = await createTransfer({
        from_bin_location_id: fromBin,
        to_bin_location_id: toBin,
        notes,
        items: draftItems.map((d) => ({ product_id: d.product_id, quantity: d.quantity })),
      });
      if (!r.success) return setMessage({ type: 'error', text: r.error });
      setMessage({ type: 'success', text: `Transfer ${r.data.transfer_number} created` });
      setShowCreate(false);
      void refresh();
    });

  /* ---------- lifecycle ---------- */
  const doAction = (fn: () => Promise<{ success: boolean; error?: string | null }>, okText: string) =>
    withBusy(async () => {
      const r = await fn();
      if (!r.success) return setMessage({ type: 'error', text: r.error ?? 'Action failed' });
      setMessage({ type: 'success', text: okText });
      void refresh();
    });

  const openView = async (t: TransferDTO) => {
    setViewing(t);
    const r = await getTransferItems(t.id);
    if (r.success) setViewItems(r.data);
  };

  /* ---------- kits ---------- */
  const openEditKit = async (kit: KitDTO) => {
    const r = await getKitComponents(kit.product_id);
    setEditKit(kit);
    setBom(r.success ? r.data : []);
    setBomPick('');
  };

  const saveBom = () =>
    withBusy(async () => {
      if (!editKit) return;
      const r = await setKitComponents({
        kit_product_id: editKit.product_id,
        components: bom.map((c) => ({ component_product_id: c.component_product_id, quantity: c.quantity })),
      });
      if (!r.success) return setMessage({ type: 'error', text: r.error });
      setMessage({ type: 'success', text: `${editKit.product_sku} contents saved` });
      setEditKit(null);
      void refresh();
    });

  const binOptions = bins.filter((b) => b.bin_location !== 'IN-TRANSIT');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" /> Transfers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Move stock between bins, zones, and storerooms — with dispatch, receipt, and custody audit.
          </p>
        </div>
        <div className="flex gap-2">
          {canDispatch && (
            <button
              onClick={() => setShowMoveAll(true)}
              className="px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted text-sm font-medium flex items-center gap-2"
            >
              <MoveRight className="w-4 h-4" /> Move all in a bin
            </button>
          )}
          {canCreate && (
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> New transfer
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
          onClick={() => setMessage(null)}
        >
          {message.text}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transfers…"
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
        />
      </div>

      {/* Transfer documents */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Transfer</th>
              <th className="text-left px-4 py-3">Route</th>
              <th className="text-left px-4 py-3">Items</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Custody</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((t) => (
              <tr key={t.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-mono text-foreground">{t.transfer_number}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {t.from_bin_label} <ArrowRight className="w-3 h-3 inline mx-1" /> {t.to_bin_label}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t.item_count}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_STYLE[t.status]}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {t.created_by_name ?? '—'}
                  {t.dispatched_at && ' → dispatched'}
                  {t.received_at && ' → received'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => void openView(t)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                      title="View items"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {t.status === 'draft' && canDispatch && (
                      <button
                        disabled={busy}
                        onClick={() => void doAction(() => dispatchTransfer(t.id), `${t.transfer_number} dispatched`)}
                        className="p-1.5 rounded-md hover:bg-muted text-amber-400"
                        title="Dispatch (stock leaves the bin, enters transit)"
                      >
                        <Truck className="w-4 h-4" />
                      </button>
                    )}
                    {t.status === 'dispatched' && canReceive && (
                      <button
                        disabled={busy}
                        onClick={() => void doAction(() => receiveTransfer(t.id), `${t.transfer_number} received`)}
                        className="p-1.5 rounded-md hover:bg-muted text-emerald-400"
                        title="Receive (stock lands at destination)"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {(t.status === 'draft' || t.status === 'dispatched') && canCancel && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void doAction(
                            () => cancelTransfer({ transfer_id: t.id, reason: 'Cancelled from transfers page' }),
                            `${t.transfer_number} cancelled`,
                          )
                        }
                        className="p-1.5 rounded-md hover:bg-muted text-red-400"
                        title="Cancel (returns transit stock to source)"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No transfers yet — create one to move stock between bins.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Kits section (roadmap 2c) */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Boxes className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground">Kits &amp; bundles</h2>
          <span className="text-xs text-muted-foreground">— assemble from components, or define a kit on any product</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Kit</th>
              <th className="text-left px-4 py-3">Components</th>
              <th className="text-left px-4 py-3">In stock</th>
              <th className="text-left px-4 py-3">Can build</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {kits.map((k) => (
              <tr key={k.product_id} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-foreground font-medium">
                  {k.product_sku} — {k.product_name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{k.component_count}</td>
                <td className="px-4 py-3 text-muted-foreground">{k.current_stock} {k.product_unit}</td>
                <td className="px-4 py-3 text-muted-foreground">{k.buildable}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {canEditBom && (
                      <button onClick={() => void openEditKit(k)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground" title="Edit contents">
                        <Wrench className="w-4 h-4" />
                      </button>
                    )}
                    {canAssemble && k.buildable > 0 && (
                      <button
                        disabled={busy}
                        onClick={() => void doAction(() => assembleKit({ kit_product_id: k.product_id, quantity: 1 }), `Assembled 1 × ${k.product_sku}`)}
                        className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20"
                      >
                        Assemble 1
                      </button>
                    )}
                    {canAssemble && k.current_stock > 0 && (
                      <button
                        disabled={busy}
                        onClick={() => void doAction(() => disassembleKit({ kit_product_id: k.product_id, quantity: 1 }), `Disassembled 1 × ${k.product_sku}`)}
                        className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/80"
                      >
                        Break 1
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {kits.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No kits defined — pick a product below to give it contents.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {canEditBom && (
          <div className="px-4 py-3 border-t border-border">
            <select
              value=""
              onChange={(e) => {
                const p = products.find((x) => x.id === e.target.value);
                if (p) {
                  setEditKit({ product_id: p.id, product_sku: p.sku, product_name: p.name, product_unit: p.unit_of_measure ?? 'pcs', current_stock: 0, component_count: 0, buildable: 0 });
                  setBom([]);
                }
              }}
              className="px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
            >
              <option value="">+ Define kit contents on a product…</option>
              {products
                .filter((p) => !kits.some((k) => k.product_id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
            </select>
          </div>
        )}
      </div>

      {/* Create transfer modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[85vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-4">New transfer</h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-muted-foreground">From bin</label>
                <select value={fromBin} onChange={(e) => { setFromBin(e.target.value); setDraftItems([]); }} className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                  <option value="">Select…</option>
                  {binOptions.map((b) => <option key={b.id} value={b.id}>{b.zone} / {b.bin_location}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To bin</label>
                <select value={toBin} onChange={(e) => setToBin(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                  <option value="">Select…</option>
                  {binOptions.filter((b) => b.id !== fromBin).map((b) => <option key={b.id} value={b.id}>{b.zone} / {b.bin_location}</option>)}
                </select>
              </div>
            </div>

            {fromBin && (
              <div className="mb-4">
                <label className="text-xs text-muted-foreground">Add item at {binOptions.find((b) => b.id === fromBin)?.bin_location}</label>
                <select value={pickId} onChange={(e) => e.target.value && addDraftItem(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                  <option value="">Pick a product…</option>
                  {binStock
                    .filter((s) => s.quantity > 0 && !draftItems.some((d) => d.product_id === s.product_id))
                    .map((s) => <option key={s.product_id} value={s.product_id}>{s.product_sku} — {s.product_name} ({s.quantity} avail)</option>)}
                </select>
                {binStock.length === 0 && <p className="text-xs text-muted-foreground mt-2">No stock recorded at this bin yet.</p>}
              </div>
            )}

            {draftItems.length > 0 && (
              <table className="w-full text-sm mb-4">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr><th className="text-left py-1">Product</th><th className="text-left">Qty</th><th className="text-left">Avail</th><th /></tr>
                </thead>
                <tbody>
                  {draftItems.map((d) => (
                    <tr key={d.product_id}>
                      <td className="py-1 text-foreground">{d.sku} — {d.name}</td>
                      <td><input type="number" min={1} max={d.max} value={d.quantity} onChange={(e) => setDraftItems(draftItems.map((x) => x.product_id === d.product_id ? { ...x, quantity: Number(e.target.value) } : x))} className="w-20 px-2 py-1 rounded bg-background border border-border text-foreground" /></td>
                      <td className="text-muted-foreground">{d.max} {d.unit}</td>
                      <td><button onClick={() => setDraftItems(draftItems.filter((x) => x.product_id !== d.product_id))} className="text-red-400 p-1"><X className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm">Cancel</button>
              <button
                disabled={busy || !fromBin || !toBin || draftItems.length === 0 || draftItems.some((d) => d.quantity <= 0 || d.quantity > d.max)}
                onClick={() => void submitCreate()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
              >
                Create draft
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move-all modal */}
      {showMoveAll && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowMoveAll(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-1">Move all bin contents</h3>
            <p className="text-xs text-muted-foreground mb-4">Every product in the source bin relocates to the destination as one completed transfer.</p>
            <div className="space-y-3 mb-4">
              <select value={moveFrom} onChange={(e) => setMoveFrom(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                <option value="">From bin…</option>
                {binOptions.map((b) => <option key={b.id} value={b.id}>{b.zone} / {b.bin_location}</option>)}
              </select>
              <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm">
                <option value="">To bin…</option>
                {binOptions.filter((b) => b.id !== moveFrom).map((b) => <option key={b.id} value={b.id}>{b.zone} / {b.bin_location}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowMoveAll(false)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm">Cancel</button>
              <button
                disabled={busy || !moveFrom || !moveTo}
                onClick={() =>
                  void withBusy(async () => {
                    const r = await moveAllBinContents({ from_bin_location_id: moveFrom, to_bin_location_id: moveTo });
                    if (!r.success) return setMessage({ type: 'error', text: r.error });
                    setMessage({ type: 'success', text: r.data.moved === 0 ? 'Source bin is empty' : `Relocated ${r.data.moved} products` });
                    setShowMoveAll(false);
                    void refresh();
                  })
                }
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
              >
                Move everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer detail modal */}
      {viewing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewing(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground font-mono">{viewing.transfer_number}</h3>
                <p className="text-sm text-muted-foreground">{viewing.from_bin_label} → {viewing.to_bin_label}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_STYLE[viewing.status]}`}>{viewing.status}</span>
            </div>
            <table className="w-full text-sm mb-4">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr><th className="text-left py-1">Product</th><th className="text-left">Qty</th><th className="text-left">Dispatched</th><th className="text-left">Received</th></tr>
              </thead>
              <tbody>
                {viewItems.map((i) => (
                  <tr key={i.id}>
                    <td className="py-1 text-foreground">{i.product_sku} — {i.product_name}</td>
                    <td className="text-muted-foreground">{i.quantity}</td>
                    <td className="text-muted-foreground">{i.dispatched_quantity}</td>
                    <td className="text-muted-foreground">{i.received_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Created by {viewing.created_by_name ?? '—'} {viewing.created_at ? `· ${new Date(viewing.created_at).toLocaleString()}` : ''}</p>
              {viewing.dispatched_at && <p>Dispatched {new Date(viewing.dispatched_at).toLocaleString()}</p>}
              {viewing.received_at && <p>Received {new Date(viewing.received_at).toLocaleString()}</p>}
              {viewing.notes && <p>Notes: {viewing.notes}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Kit BOM editor modal */}
      {editKit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditKit(null)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2"><Package className="w-4 h-4" /> {editKit.product_sku} — {editKit.product_name}</h3>
            <p className="text-xs text-muted-foreground mb-4">Components consumed to assemble one unit of this kit.</p>
            <select value={bomPick} onChange={(e) => {
              const p = products.find((x) => x.id === e.target.value);
              if (p && !bom.some((c) => c.component_product_id === p.id)) {
                setBom([...bom, { component_product_id: p.id, product_sku: p.sku, product_name: p.name, product_unit: p.unit_of_measure ?? 'pcs', quantity: 1, component_stock: Number(p.current_stock) }]);
              }
              setBomPick('');
            }} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm mb-3">
              <option value="">+ Add component…</option>
              {products.filter((p) => p.id !== editKit.product_id && !bom.some((c) => c.component_product_id === p.id)).map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name} ({p.current_stock} in stock)</option>
              ))}
            </select>
            {bom.length > 0 && (
              <table className="w-full text-sm mb-4">
                <thead className="text-xs text-muted-foreground uppercase"><tr><th className="text-left py-1">Component</th><th className="text-left">Qty / kit</th><th className="text-left">In stock</th><th /></tr></thead>
                <tbody>
                  {bom.map((c) => (
                    <tr key={c.component_product_id}>
                      <td className="py-1 text-foreground">{c.product_sku} — {c.product_name}</td>
                      <td><input type="number" min={0.001} step="any" value={c.quantity} onChange={(e) => setBom(bom.map((x) => x.component_product_id === c.component_product_id ? { ...x, quantity: Number(e.target.value) } : x))} className="w-20 px-2 py-1 rounded bg-background border border-border text-foreground" /></td>
                      <td className="text-muted-foreground">{c.component_stock} {c.product_unit}</td>
                      <td><button onClick={() => setBom(bom.filter((x) => x.component_product_id !== c.component_product_id))} className="text-red-400 p-1"><X className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditKit(null)} className="px-4 py-2 rounded-lg border border-border text-muted-foreground text-sm">Cancel</button>
              <button disabled={busy || bom.length === 0} onClick={() => void saveBom()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40">
                Save contents
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
