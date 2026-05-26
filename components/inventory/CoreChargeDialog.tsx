'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, AlertCircle } from 'lucide-react';

interface CoreChargeDialogProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  coreChargeAmount: number;
  onSuccess: () => void;
}

export default function CoreChargeDialog({
  open,
  onClose,
  productId,
  productName,
  coreChargeAmount,
  onSuccess,
}: CoreChargeDialogProps) {
  const [formData, setFormData] = useState({
    return_status: 'pending',
    return_date: '',
    credit_applied: false,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.return_status === 'returned' && !formData.return_date) {
      newErrors.return_date = 'Return date is required when status is returned';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/products/${productId}/core-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to update core charge status');

      onSuccess();
      onClose();
      setFormData({ return_status: 'pending', return_date: '', credit_applied: false, notes: '' });
    } catch (error) {
      console.error('Error updating core charge:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as any;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Core Charge Management</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900">{productName}</p>
            <div className="flex items-center gap-2 mt-2">
              <DollarSign className="h-4 w-4 text-blue-600" />
              <p className="text-lg font-bold text-blue-900">${coreChargeAmount.toFixed(2)}</p>
              <p className="text-sm text-blue-700">core charge</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Return Status</label>
              <select
                name="return_status"
                value={formData.return_status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="pending">Pending - Not Returned</option>
                <option value="returned">Returned - Credit Due</option>
                <option value="credited">Credited - Complete</option>
                <option value="forfeited">Forfeited - No Credit</option>
              </select>
            </div>

            {formData.return_status === 'returned' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Date *</label>
                <input
                  type="date"
                  name="return_date"
                  value={formData.return_date}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg ${errors.return_date ? 'border-red-500' : 'border-gray-300'}`}
                />
                {errors.return_date && <p className="text-sm text-red-600 mt-1">{errors.return_date}</p>}
              </div>
            )}

            {formData.return_status === 'returned' && (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <input
                  type="checkbox"
                  name="credit_applied"
                  id="credit_applied"
                  checked={formData.credit_applied}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-green-600 rounded"
                />
                <label htmlFor="credit_applied" className="text-sm text-green-800">
                  Credit has been applied to customer account
                </label>
              </div>
            )}

            {formData.return_status === 'forfeited' && (
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Core Charge Forfeited</p>
                  <p className="text-xs text-red-700">Customer will not receive credit for this core return</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Additional notes about core return..."
              />
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
                  'Update Status'
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
