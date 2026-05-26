'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface StockMovementDialogProps {
  open: boolean;
  onClose: () => void;
  movementType: 'inbound' | 'outbound' | 'scrap';
  onSuccess: () => void;
}

export default function StockMovementDialog({ open, onClose, movementType, onSuccess }: StockMovementDialogProps) {
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: 0,
    reference: '',
    reason: '',
    bin_id: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const movementLabels = {
    inbound: 'Inbound Receipt',
    outbound: 'Outbound Issue',
    scrap: 'Scrap Movement',
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.product_id) newErrors.product_id = 'Product is required';
    if (formData.quantity <= 0) newErrors.quantity = 'Quantity must be greater than 0';
    if (!formData.reference) newErrors.reference = 'Reference is required';
    if (movementType === 'scrap' && !formData.reason) newErrors.reason = 'Reason is required for scrap';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          movement_type: movementType,
        }),
      });

      if (!response.ok) throw new Error('Failed to record movement');

      onSuccess();
      onClose();
      setFormData({ product_id: '', quantity: 0, reference: '', reason: '', bin_id: '' });
    } catch (error) {
      console.error('Error recording movement:', error);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{movementLabels[movementType]}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
            <select
              name="product_id"
              value={formData.product_id}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg ${errors.product_id ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select product</option>
              <option value="1">Brake Pad Set</option>
              <option value="2">Oil Filter</option>
              <option value="3">Air Filter</option>
            </select>
            {errors.product_id && <p className="text-sm text-red-600 mt-1">{errors.product_id}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={handleInputChange}
              min="1"
              className={`w-full px-3 py-2 border rounded-lg ${errors.quantity ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.quantity && <p className="text-sm text-red-600 mt-1">{errors.quantity}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reference *</label>
            <input
              name="reference"
              value={formData.reference}
              onChange={handleInputChange}
              placeholder={movementType === 'inbound' ? 'PO-2024-001' : movementType === 'outbound' ? 'SO-2024-001' : 'SCR-2024-001'}
              className={`w-full px-3 py-2 border rounded-lg ${errors.reference ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.reference && <p className="text-sm text-red-600 mt-1">{errors.reference}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bin Location</label>
            <input
              name="bin_id"
              value={formData.bin_id}
              onChange={handleInputChange}
              placeholder="Zone-A-01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          {movementType === 'scrap' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.reason ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">Select reason</option>
                <option value="damaged">Damaged</option>
                <option value="expired">Expired</option>
                <option value="defective">Defective</option>
                <option value="lost">Lost</option>
                <option value="other">Other</option>
              </select>
              {errors.reason && <p className="text-sm text-red-600 mt-1">{errors.reason}</p>}
            </div>
          )}

          {movementType === 'outbound' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select reason (optional)</option>
                <option value="sale">Sale</option>
                <option value="transfer">Transfer</option>
                <option value="return">Return</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                'Record Movement'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
