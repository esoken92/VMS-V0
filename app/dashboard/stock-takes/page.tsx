'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Search, ClipboardList, CheckCircle, Play, Eye } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  listStockTakes,
  getStockTakeItems,
  startStockTake,
  saveStockTakeCounts,
  completeStockTake,
} from '@/lib/actions/stock-takes';
import { listProducts } from '@/lib/actions/products';
import type { StockTakeDTO, ProductDTO } from '@/lib/types';

type StockTake = StockTakeDTO;
type Product = ProductDTO;

export default function StockTakesPage() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeStockTake, setActiveStockTake] = useState<StockTake | null>(null);
  const [countingMode, setCountingMode] = useState(false);
  const [countedItems, setCountedItems] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false); // sync guard — blocks same-tick double-clicks
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchStockTakes();
    fetchProducts();
  }, []);

  const fetchStockTakes = async () => {
    try {
      const result = await listStockTakes();
      if (!result.success) throw new Error(result.error);
      setStockTakes(result.data);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load stock takes' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const result = await listProducts();
      if (result.success) setProducts(result.data);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const handleStartStockTake = async () => {
    if (!profile || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await startStockTake({});
      if (!result.success) throw new Error(result.error);
      setMessage({ type: 'success', text: 'Stock take started successfully' });
      fetchStockTakes();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to start stock take' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleContinueStockTake = async (stockTake: StockTake) => {
    setActiveStockTake(stockTake);
    setCountedItems({});
    setNotes(stockTake.notes || '');

    // Load existing counts for this stock take
    try {
      const result = await getStockTakeItems(stockTake.id);
      if (result.success) {
        const existingCounts: Record<string, number> = {};
        for (const item of result.data) {
          if (item.physical_qty !== null) {
            existingCounts[item.product_id] = item.physical_qty;
          }
        }
        setCountedItems(existingCounts);
      }
    } catch (err) {
      console.error('Error loading existing counts:', err);
    }

    setCountingMode(true);
  };

  const handleViewStockTake = (stockTake: StockTake) => {
    setActiveStockTake(stockTake);
    setShowModal(true);
  };

  const handleSaveDraft = async () => {
    if (!activeStockTake || !profile || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    try {
      const result = await saveStockTakeCounts({
        stock_take_id: activeStockTake.id,
        counts: Object.entries(countedItems).map(([product_id, physical_qty]) => ({
          product_id,
          physical_qty,
        })),
        notes: notes || null,
      });
      if (!result.success) throw new Error(result.error);

      setMessage({ type: 'success', text: 'Draft saved successfully' });
      setCountingMode(false);
      setActiveStockTake(null);
      fetchStockTakes();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleCompleteStockTake = async () => {
    if (!activeStockTake || !profile || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    try {
      // Send an entry for every product — null when uncounted (matches the
      // original loop that upserted every product).
      const result = await completeStockTake({
        stock_take_id: activeStockTake.id,
        counts: products.map((product) => ({
          product_id: product.id,
          physical_qty: countedItems[product.id] ?? null,
        })),
        notes: notes || null,
      });
      if (!result.success) throw new Error(result.error);

      setMessage({ type: 'success', text: 'Stock take completed successfully' });
      setCountingMode(false);
      setActiveStockTake(null);
      fetchStockTakes();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Complete failed' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const filteredStockTakes = stockTakes.filter(stockTake =>
    stockTake.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stockTake.started_by_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-info/10 text-info';
      case 'completed': return 'bg-success/10 text-success';
      default: return 'bg-muted text-foreground';
    }
  };

  const getProgress = (stockTake: StockTake) =>
    `${stockTake.items_counted}/${stockTake.items_total}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Takes</h1>
          <p className="text-muted-foreground mt-1">Perform blind inventory counts</p>
        </div>
        <button
          onClick={handleStartStockTake}
          disabled={busy}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {busy ? 'Working…' : 'Start New Stock Take'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {/* Counting Mode */}
      {countingMode && activeStockTake && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-lg font-semibold text-foreground">Stock Take in Progress</h2>
                <p className="text-sm text-muted-foreground">ID: {activeStockTake.id.slice(0, 8)}</p>
              </div>
            </div>
            <button
              onClick={() => setCountingMode(false)}
              className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              rows={2}
              placeholder="Add notes about this stock take..."
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-4 p-3 bg-card rounded-lg border border-border">
                <div className="flex-1">
                  <p className="font-medium text-foreground">{product.sku} - {product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.unit_of_measure}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-foreground">Count:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={countedItems[product.id] !== undefined ? countedItems[product.id] : ''}
                    onChange={(e) => setCountedItems({
                      ...countedItems,
                      [product.id]: parseFloat(e.target.value) || 0
                    })}
                    className="w-24 px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="0"
                  />
                  <span className="text-sm text-muted-foreground">{product.unit_of_measure}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={handleSaveDraft}
              disabled={busy}
              className="px-4 py-2 border border-input rounded-lg hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {busy ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={handleCompleteStockTake}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-lg hover:bg-success/90 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              {busy ? 'Completing…' : 'Complete Stock Take'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search stock takes by ID, zone, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Stock Takes Table */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading stock takes...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Started By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Started</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredStockTakes.map((stockTake) => (
                <tr key={stockTake.id} className="hover:bg-muted">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground" title={stockTake.id}>{stockTake.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                    {stockTake.started_by_name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {stockTake.started_at ? new Date(stockTake.started_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{getProgress(stockTake)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(stockTake.status)}`}>
                      {stockTake.status.charAt(0).toUpperCase() + stockTake.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {stockTake.status === 'open' ? (
                      <button
                        onClick={() => handleContinueStockTake(stockTake)}
                        className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
                      >
                        <Play className="h-4 w-4" />
                        Continue
                      </button>
                    ) : (
                      <button
                        onClick={() => handleViewStockTake(stockTake)}
                        className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredStockTakes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No stock takes found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* View Modal */}
      {showModal && activeStockTake && (
        <div className="fixed inset-0 bg-sidebar/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Stock Take Details</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">ID</p>
                  <p className="font-medium text-foreground" title={activeStockTake.id}>{activeStockTake.id.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium text-foreground capitalize">{activeStockTake.status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="font-medium text-foreground">{activeStockTake.started_at ? new Date(activeStockTake.started_at).toLocaleString() : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="font-medium text-foreground">
                    {activeStockTake.completed_at ? new Date(activeStockTake.completed_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
              {activeStockTake.notes && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-foreground">{activeStockTake.notes}</p>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
