'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface StockTakeCountDialogProps {
  open: boolean;
  onClose: () => void;
  stockTakeId: string;
  productId: string;
  productName: string;
  binLocation: string;
  onSuccess: () => void;
}

export default function StockTakeCountDialog({
  open,
  onClose,
  stockTakeId,
  productId,
  productName,
  binLocation,
  onSuccess,
}: StockTakeCountDialogProps) {
  const [countedQuantity, setCountedQuantity] = useState('');
  const [showSystemQuantity, setShowSystemQuantity] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!countedQuantity) {
      newErrors.countedQuantity = 'Counted quantity is required';
    } else if (parseInt(countedQuantity) < 0) {
      newErrors.countedQuantity = 'Cannot be negative';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/stock-takes/${stockTakeId}/counts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          counted_quantity: parseInt(countedQuantity),
          notes,
        }),
      });

      if (!response.ok) throw new Error('Failed to record count');

      onSuccess();
      onClose();
      setCountedQuantity('');
      setNotes('');
      setShowSystemQuantity(false);
    } catch (error) {
      console.error('Error recording count:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Blind Count Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm font-medium text-gray-900">{productName}</p>
            <p className="text-sm text-gray-600">Location: {binLocation}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Counted Quantity *
              </label>
              <input
                type="number"
                value={countedQuantity}
                onChange={(e) => setCountedQuantity(e.target.value)}
                min="0"
                className={`w-full px-3 py-2 border rounded-lg ${errors.countedQuantity ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter counted quantity"
              />
              {errors.countedQuantity && (
                <p className="text-sm text-red-600 mt-1">{errors.countedQuantity}</p>
              )}
            </div>

            {/* System Quantity - Hidden by default (blind count) */}
            <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-yellow-800">System Quantity</p>
                <p className="text-xs text-yellow-600">Hidden for blind count accuracy</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSystemQuantity(!showSystemQuantity)}
                className="flex items-center gap-2 text-sm text-yellow-700 hover:text-yellow-800"
              >
                {showSystemQuantity ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Reveal
                  </>
                )}
              </button>
            </div>

            {showSystemQuantity && (
              <div className="p-3 bg-gray-100 rounded-lg">
                <p className="text-lg font-bold text-gray-900">150</p>
                <p className="text-xs text-gray-600">Current system quantity</p>
              </div>
            )}

            {/* Variance Warning */}
            {countedQuantity && showSystemQuantity && (
              <div className={`p-3 rounded-lg ${
                parseInt(countedQuantity) === 150
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <p className={`text-sm font-medium ${
                  parseInt(countedQuantity) === 150 ? 'text-green-800' : 'text-red-800'
                }`}>
                  {parseInt(countedQuantity) === 150
                    ? 'No variance detected'
                    : `Variance: ${parseInt(countedQuantity) - 150} units`
                  }
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Any observations or issues..."
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
                    Recording...
                  </>
                ) : (
                  'Record Count'
                )}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
