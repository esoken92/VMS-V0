'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, ClipboardList, CheckCircle, Clock, Play, Eye } from 'lucide-react';
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
    if (!profile) return;
    try {
      const result = await startStockTake({});
      if (!result.success) throw new Error(result.error);
      setMessage({ type: 'success', text: 'Stock take started successfully' });
      fetchStockTakes();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to start stock take' });
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
    if (!activeStockTake || !profile) return;

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
    }
  };

  const handleCompleteStockTake = async () => {
    if (!activeStockTake || !profile) return;

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
    }
  };

  const filteredStockTakes = stockTakes.filter(stockTake =>
    stockTake.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stockTake.started_by_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getProgress = (stockTake: StockTake) =>
    `${stockTake.items_counted}/${stockTake.items_total}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Takes</h1>
          <p className="text-gray-600 mt-1">Perform blind inventory counts</p>
        </div>
        <button
          onClick={handleStartStockTake}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Start New Stock Take
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Counting Mode */}
      {countingMode && activeStockTake && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Stock Take in Progress</h2>
                <p className="text-sm text-gray-600">ID: {activeStockTake.id}</p>
              </div>
            </div>
            <button
              onClick={() => setCountingMode(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Add notes about this stock take..."
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {products.map((product) => (
              <div key={product.id} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{product.sku} - {product.name}</p>
                  <p className="text-sm text-gray-600">System: {product.current_stock} {product.unit_of_measure}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Count:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={countedItems[product.id] !== undefined ? countedItems[product.id] : ''}
                    onChange={(e) => setCountedItems({
                      ...countedItems,
                      [product.id]: parseFloat(e.target.value) || 0
                    })}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-600">{product.unit_of_measure}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={handleSaveDraft}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={handleCompleteStockTake}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              Complete Stock Take
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search stock takes by ID, zone, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stock Takes Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading stock takes...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStockTakes.map((stockTake) => (
                <tr key={stockTake.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stockTake.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {stockTake.started_by_name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {stockTake.started_at ? new Date(stockTake.started_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{getProgress(stockTake)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(stockTake.status)}`}>
                      {stockTake.status.charAt(0).toUpperCase() + stockTake.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {stockTake.status === 'open' ? (
                      <button
                        onClick={() => handleContinueStockTake(stockTake)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <Play className="h-4 w-4" />
                        Continue
                      </button>
                    ) : (
                      <button
                        onClick={() => handleViewStockTake(stockTake)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
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
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No stock takes found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* View Modal */}
      {showModal && activeStockTake && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Stock Take Details</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">ID</p>
                  <p className="font-medium text-gray-900">{activeStockTake.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-medium text-gray-900 capitalize">{activeStockTake.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Started</p>
                  <p className="font-medium text-gray-900">{activeStockTake.started_at ? new Date(activeStockTake.started_at).toLocaleString() : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="font-medium text-gray-900">
                    {activeStockTake.completed_at ? new Date(activeStockTake.completed_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
              {activeStockTake.notes && (
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-1">Notes</p>
                  <p className="text-gray-900">{activeStockTake.notes}</p>
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
