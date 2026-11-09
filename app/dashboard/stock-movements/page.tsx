'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, ArrowDown, ArrowUp, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  listStockMovements,
  recordStockMovement,
} from '@/lib/actions/stock-movements';
import { listProducts } from '@/lib/actions/products';
import type { StockMovementDTO, ProductDTO } from '@/lib/types';

type StockMovement = StockMovementDTO;
type Product = ProductDTO;

export default function StockMovementsPage() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [movementType, setMovementType] = useState<'inbound' | 'outbound' | 'scrap'>('inbound');
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: 0,
    reason: '',
    reference: '',
    scrap_image: null as File | null,
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchMovements();
    fetchProducts();
  }, []);

  const fetchMovements = async () => {
    try {
      const result = await listStockMovements(50);
      if (!result.success) throw new Error(result.error);
      setMovements(result.data);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load movements' });
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

  const handleRecordMovement = async (type: 'inbound' | 'outbound' | 'scrap') => {
    setMovementType(type);
    setFormData({
      product_id: '',
      quantity: 0,
      reason: '',
      reference: '',
      scrap_image: null,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      let scrapImageUrl: string | null = null;

      // Upload scrap image via the local uploads API (no object storage on
      // this self-hosted instance — files land in ./uploads, streamed by
      // GET /api/uploads/[file]).
      if (movementType === 'scrap' && formData.scrap_image) {
        const body = new FormData();
        body.append('file', formData.scrap_image);
        body.append('kind', 'scrap');
        const res = await fetch('/api/uploads', { method: 'POST', body });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || 'Image upload failed');
        }
        const data = (await res.json()) as { url: string };
        scrapImageUrl = data.url;
      }

      // Record movement + stock update atomically (server action, role-gated)
      const result = await recordStockMovement({
        product_id: formData.product_id,
        type: movementType,
        quantity: formData.quantity,
        reason: formData.reason || null,
        scrap_image_url: scrapImageUrl,
      });
      if (!result.success) throw new Error(result.error);

      setMessage({ type: 'success', text: `${movementType.charAt(0).toUpperCase() + movementType.slice(1)} movement recorded successfully` });
      setShowModal(false);
      fetchMovements();
      fetchProducts();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to record movement' });
    }
  };

  const filteredMovements = movements.filter(movement =>
    movement.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    movement.product_sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    movement.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    movement.reason?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'inbound': return 'bg-green-100 text-green-700';
      case 'outbound': return 'bg-blue-100 text-blue-700';
      case 'scrap': return 'bg-red-100 text-red-700';
      case 'adjustment': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getQuantityColor = (type: string) => {
    switch (type) {
      case 'inbound': return 'text-green-600';
      case 'outbound': return 'text-blue-600';
      case 'scrap': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
          <p className="text-gray-600 mt-1">Track inbound, outbound, and scrap movements</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleRecordMovement('inbound')}
          className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
        >
          <div className="p-2 bg-green-100 rounded-lg">
            <ArrowDown className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Inbound Receipt</p>
            <p className="text-sm text-gray-600">Receive stock from supplier</p>
          </div>
        </button>
        <button
          onClick={() => handleRecordMovement('outbound')}
          className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
        >
          <div className="p-2 bg-blue-100 rounded-lg">
            <ArrowUp className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Outbound Issue</p>
            <p className="text-sm text-gray-600">Issue stock to customer</p>
          </div>
        </button>
        <button
          onClick={() => handleRecordMovement('scrap')}
          className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
        >
          <div className="p-2 bg-red-100 rounded-lg">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Scrap Movement</p>
            <p className="text-sm text-gray-600">Record damaged/defective items</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search movements by product, reference, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading movements...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredMovements.map((movement) => (
                <tr key={movement.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {movement.created_at ? new Date(movement.created_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(movement.type)}`}>
                      {movement.type.charAt(0).toUpperCase() + movement.type.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {movement.product_name || 'Unknown'} ({movement.product_sku || ''})
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium {getQuantityColor(movement.type)}">
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity} {movement.product_unit || ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{movement.reason || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {movement.user_name || 'Unknown'}
                  </td>
                </tr>
              ))}
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No movements found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Movement Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Record {movementType.charAt(0).toUpperCase() + movementType.slice(1)} Movement
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} - {p.name} (Stock: {p.current_stock} {p.unit_of_measure})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Enter reason for this movement..."
                />
              </div>
              {movementType === 'scrap' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scrap Image</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <Upload className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Choose Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFormData({ ...formData, scrap_image: e.target.files?.[0] || null })}
                        className="hidden"
                      />
                    </label>
                    {formData.scrap_image && (
                      <span className="text-sm text-gray-600">{formData.scrap_image.name}</span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Record Movement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
