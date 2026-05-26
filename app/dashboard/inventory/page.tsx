'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreVertical, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';

interface Product {
  id: string;
  sku: string;
  name: string;
  item_type: 'consumable' | 'fluid' | 'tool' | 'tire';
  current_stock: number;
  min_threshold: number;
  average_cost: number;
  unit_of_measure: string;
  issuing_unit: string;
  bin_location_id: string | null;
  supplier_id: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface BinLocation {
  id: string;
  zone: string;
  bin_location: string;
}

export default function InventoryPage() {
  const { hasRole } = useAuth();
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [binLocations, setBinLocations] = useState<BinLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    item_type: 'consumable' as const,
    current_stock: 0,
    min_threshold: 0,
    average_cost: 0,
    unit_of_measure: '',
    issuing_unit: '',
    supplier_id: '',
    bin_location_id: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canEdit = hasRole(['manager', 'admin', 'super_admin']);
  const canDelete = hasRole(['admin', 'super_admin']);

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    fetchBinLocations();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('sku');
      if (error) throw error;
      setProducts(data || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');
      if (error) throw error;
      setSuppliers(data || []);
    } catch (err: any) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchBinLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('bin_locations')
        .select('*')
        .order('zone, bin_location');
      if (error) throw error;
      setBinLocations(data || []);
    } catch (err: any) {
      console.error('Error fetching bin locations:', err);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setFormData({
      sku: '',
      name: '',
      item_type: 'consumable',
      current_stock: 0,
      min_threshold: 0,
      average_cost: 0,
      unit_of_measure: '',
      issuing_unit: '',
      supplier_id: '',
      bin_location_id: '',
    });
    setShowModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      // @ts-ignore - Supabase type issue
      item_type: product.item_type,
      current_stock: product.current_stock,
      min_threshold: product.min_threshold,
      average_cost: product.average_cost,
      unit_of_measure: product.unit_of_measure,
      issuing_unit: product.issuing_unit,
      supplier_id: product.supplier_id || '',
      bin_location_id: product.bin_location_id || '',
    });
    setShowModal(true);
  };

  const handleDeleteProduct = async () => {
    if (!deleteProduct) return;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteProduct.id);
      if (error) throw error;
      setMessage({ type: 'success', text: 'Product deleted successfully' });
      setDeleteProduct(null);
      fetchProducts();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = {
        ...formData,
        supplier_id: formData.supplier_id || null,
        bin_location_id: formData.bin_location_id || null,
      };

      if (editingProduct) {
        // @ts-ignore - Supabase type issue
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        if (error) throw error;
        setMessage({ type: 'success', text: 'Product updated successfully' });
      } else {
        // @ts-ignore - Supabase type issue
        const { error } = await supabase
          .from('products')
          .insert(productData);
        if (error) throw error;
        setMessage({ type: 'success', text: 'Product added successfully' });
      }
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const filteredProducts = products.filter(product =>
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStockStatus = (product: Product) => {
    if (product.current_stock === 0) return 'out_of_stock';
    if (product.current_stock <= product.min_threshold) return 'low_stock';
    return 'in_stock';
  };

  const getStockColor = (status: string) => {
    switch (status) {
      case 'out_of_stock': return 'text-red-600';
      case 'low_stock': return 'text-yellow-600';
      default: return 'text-green-600';
    }
  };

  const getBinLabel = (binId: string | null) => {
    if (!binId) return 'Unassigned';
    const bin = binLocations.find(b => b.id === binId);
    return bin ? `${bin.zone}-${bin.bin_location}` : 'Unassigned';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600 mt-1">Manage your product catalog</p>
        </div>
        {canEdit && (
          <button
            onClick={handleAddProduct}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by SKU, name, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Categories</option>
                <option value="consumable">Consumable</option>
                <option value="fluid">Fluid</option>
                <option value="tool">Tool</option>
                <option value="tire">Tire</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock Status</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Status</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bin Location</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Bins</option>
                {binLocations.map(b => (
                  <option key={b.id} value={b.id}>{b.zone}-{b.bin_location}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading products...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Threshold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bin</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const stockStatus = getStockStatus(product);
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize">{product.item_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium {getStockColor(stockStatus)}">
                      {product.current_stock}
                      {stockStatus === 'low_stock' && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.min_threshold}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{getBinLabel(product.bin_location_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.unit_of_measure}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="p-1 hover:bg-gray-100 rounded"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => setDeleteProduct(product)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={formData.item_type}
                    onChange={(e) => setFormData({ ...formData, item_type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="consumable">Consumable</option>
                    <option value="fluid">Fluid</option>
                    <option value="tool">Tool</option>
                    <option value="tire">Tire</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Stock</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.current_stock}
                    onChange={(e) => setFormData({ ...formData, current_stock: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.min_threshold}
                    onChange={(e) => setFormData({ ...formData, min_threshold: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Average Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.average_cost}
                    onChange={(e) => setFormData({ ...formData, average_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure *</label>
                  <input
                    type="text"
                    required
                    value={formData.unit_of_measure}
                    onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Each, Drum, Box"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Unit *</label>
                  <input
                    type="text"
                    required
                    value={formData.issuing_unit}
                    onChange={(e) => setFormData({ ...formData, issuing_unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Piece, Liter"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bin Location</label>
                <select
                  value={formData.bin_location_id}
                  onChange={(e) => setFormData({ ...formData, bin_location_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Bin Location</option>
                  {binLocations.map(b => (
                    <option key={b.id} value={b.id}>{b.zone}-{b.bin_location}</option>
                  ))}
                </select>
              </div>
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
                  {editingProduct ? 'Update' : 'Add'} Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Delete Product</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{deleteProduct.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteProduct(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
