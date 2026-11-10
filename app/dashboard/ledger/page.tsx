'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, CheckCircle2, AlertTriangle, BookOpen } from 'lucide-react';
import { getKardex } from '@/lib/actions/kardex';
import { listProducts } from '@/lib/actions/products';
import type { KardexDTO, ProductDTO, ReconciliationDTO } from '@/lib/types';

export default function LedgerPage() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [productId, setProductId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<KardexDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      const result = await listProducts();
      if (result.success) setProducts(result.data);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  }, []);

  const fetchKardex = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);
      const result = await getKardex(
        productId || undefined,
        from || undefined,
        to || undefined,
      );
      if (!result.success) throw new Error(result.error);
      setData(result.data);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load ledger' });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [productId, from, to]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchKardex();
  }, [fetchKardex]);

  const summary: ReconciliationDTO | undefined = productId
    ? data?.summaries.find((s) => s.product_id === productId)
    : undefined;

  const filteredSummaries = (data?.summaries ?? []).filter(
    (s) =>
      s.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const lastBalance = data?.entries.length
    ? data.entries[data.entries.length - 1].running_balance
    : data?.opening_balance ?? 0;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'inbound': return 'bg-green-100 text-green-700';
      case 'receiving': return 'bg-emerald-100 text-emerald-700';
      case 'outbound': return 'bg-blue-100 text-blue-700';
      case 'tool_checkout': return 'bg-indigo-100 text-indigo-700';
      case 'scrap': return 'bg-red-100 text-red-700';
      case 'adjustment': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const typeLabel = (type: string) =>
    type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  /** Display-format a quantity — r4 to match the numeric(15,4) columns. */
  const fmt = (n: number) => String(Math.round(n * 1e4) / 1e4);

  const driftBadge = (s: ReconciliationDTO) =>
    s.reconciles ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Reconciles
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700">
        <AlertTriangle className="h-3 w-3" /> Drift {s.drift > 0 ? '+' : ''}{fmt(s.drift)}
      </span>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Ledger</h1>
          <p className="text-gray-600 mt-1">Per-product movement ledger (Kardex) with running balance and reconciliation</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All products — reconciliation summary</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
        {(from || to || productId) && (
          <div className="mt-3">
            <button
              onClick={() => { setProductId(''); setFrom(''); setTo(''); }}
              className="text-sm text-primary hover:text-blue-800"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          Loading ledger...
        </div>
      ) : !data ? null : productId ? (
        <>
          {/* Selected-product reconciliation stat cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Opening</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{data.opening_balance}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Ledger Closing</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{lastBalance}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Expected (all-time)</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{summary.expected_closing}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <p className="text-xs font-medium text-gray-500 uppercase">Actual Stock</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{summary.actual_stock} {summary.unit_of_measure}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center">
                {driftBadge(summary)}
              </div>
            </div>
          )}

          {/* Ledger table */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr className="bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-500 italic" colSpan={3}>
                    Opening balance{from ? ` (before ${from})` : ''}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                    {data.opening_balance}
                  </td>
                  <td className="px-6 py-3" colSpan={2}></td>
                </tr>
                {data.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(entry.type)}`}>
                        {typeLabel(entry.type)}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${entry.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.quantity > 0 ? '+' : ''}{entry.quantity} {entry.product_unit || ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                      {entry.running_balance}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{entry.reason || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{entry.user_name || 'Unknown'}</td>
                  </tr>
                ))}
                {data.entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No movements in this window
                    </td>
                  </tr>
                )}
                {data.entries.length > 0 && (
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td className="px-6 py-3 text-sm text-gray-500 italic" colSpan={3}>Closing balance</td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">{lastBalance}</td>
                    <td className="px-6 py-3" colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
            {data.entries_truncated && (
              <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-200 text-sm text-yellow-800">
                Showing the first {data.entries.length} rows — narrow the date range or product filter.
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* All-products reconciliation summary */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-gray-400" />
              <p className="text-sm text-gray-600">
                Select a product above to view its movement ledger. The table below reconciles every
                product&apos;s recorded movements against its current stock.
              </p>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Filter by SKU or product name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Inbound</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Outbound</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Scrap</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Other</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSummaries.map((s) => (
                  <tr
                    key={s.product_id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => setProductId(s.product_id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {s.name} <span className="text-gray-500">({s.sku})</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600">
                      +{fmt(s.inbound + s.receiving)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-primary">
                      {fmt(s.outbound)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600">
                      {fmt(s.scrap)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                      {fmt(s.adjustment + s.tool_checkout)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {s.expected_closing}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {s.actual_stock} {s.unit_of_measure}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{driftBadge(s)}</td>
                  </tr>
                ))}
                {filteredSummaries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No products found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
