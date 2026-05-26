'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ProductFormDialogProps {
  open: boolean;
  onClose: () => void;
  product?: any;
  onSuccess: () => void;
}

export default function ProductFormDialog({ open, onClose, product, onSuccess }: ProductFormDialogProps) {
  const [formData, setFormData] = useState({
    sku: product?.sku || '',
    name: product?.name || '',
    description: product?.description || '',
    category: product?.category || '',
    supplier_id: product?.supplier_id || '',
    bin_id: product?.bin_id || '',
    barcode: product?.barcode || '',
    unit_of_measure: product?.unit_of_measure || 'Each',
    min_stock_level: product?.min_stock_level || 0,
    max_stock_level: product?.max_stock_level || 0,
    unit_cost: product?.unit_cost || 0,
    selling_price: product?.selling_price || 0,
    weight_kg: product?.weight_kg || 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.sku) newErrors.sku = 'SKU is required';
    if (!formData.name) newErrors.name = 'Product name is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.unit_of_measure) newErrors.unit_of_measure = 'Unit of measure is required';
    if (formData.min_stock_level < 0) newErrors.min_stock_level = 'Cannot be negative';
    if (formData.max_stock_level < 0) newErrors.max_stock_level = 'Cannot be negative';
    if (formData.unit_cost < 0) newErrors.unit_cost = 'Cannot be negative';
    if (formData.selling_price < 0) newErrors.selling_price = 'Cannot be negative';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const url = product ? `/api/products/${product.id}` : '/api/products';
      const method = product ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save product');

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
              <input
                name="sku"
                value={formData.sku}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.sku ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="BRK-001"
              />
              {errors.sku && <p className="text-sm text-red-600 mt-1">{errors.sku}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <input
                name="barcode"
                value={formData.barcode}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="1234567890123"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
              placeholder="Brake Pad Set"
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Product description..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.category ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">Select category</option>
                <option value="brakes">Brakes</option>
                <option value="filters">Filters</option>
                <option value="fluids">Fluids</option>
                <option value="electrical">Electrical</option>
                <option value="suspension">Suspension</option>
                <option value="tools">Tools</option>
              </select>
              {errors.category && <p className="text-sm text-red-600 mt-1">{errors.category}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure *</label>
              <select
                name="unit_of_measure"
                value={formData.unit_of_measure}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.unit_of_measure ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="Each">Each</option>
                <option value="Box">Box</option>
                <option value="Case">Case</option>
                <option value="Pallet">Pallet</option>
                <option value="Kg">Kilogram</option>
                <option value="L">Liter</option>
              </select>
              {errors.unit_of_measure && <p className="text-sm text-red-600 mt-1">{errors.unit_of_measure}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                name="supplier_id"
                value={formData.supplier_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select supplier</option>
                <option value="1">Supplier A</option>
                <option value="2">Supplier B</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bin Location</label>
              <input
                name="bin_id"
                value={formData.bin_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Zone-A-01"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level</label>
              <input
                type="number"
                name="min_stock_level"
                value={formData.min_stock_level}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.min_stock_level ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.min_stock_level && <p className="text-sm text-red-600 mt-1">{errors.min_stock_level}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Stock Level</label>
              <input
                type="number"
                name="max_stock_level"
                value={formData.max_stock_level}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.max_stock_level ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.max_stock_level && <p className="text-sm text-red-600 mt-1">{errors.max_stock_level}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                name="weight_kg"
                value={formData.weight_kg}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost ($)</label>
              <input
                type="number"
                step="0.01"
                name="unit_cost"
                value={formData.unit_cost}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.unit_cost ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.unit_cost && <p className="text-sm text-red-600 mt-1">{errors.unit_cost}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                name="selling_price"
                value={formData.selling_price}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.selling_price ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.selling_price && <p className="text-sm text-red-600 mt-1">{errors.selling_price}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                product ? 'Update Product' : 'Add Product'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
