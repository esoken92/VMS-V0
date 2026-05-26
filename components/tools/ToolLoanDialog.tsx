'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface ToolLoanDialogProps {
  open: boolean;
  onClose: () => void;
  action: 'checkout' | 'checkin';
  onSuccess: () => void;
}

export default function ToolLoanDialog({ open, onClose, action, onSuccess }: ToolLoanDialogProps) {
  const [formData, setFormData] = useState({
    tool_id: '',
    user_id: '',
    expected_return_date: '',
    condition: 'good',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actionLabels = {
    checkout: 'Check Out Tool',
    checkin: 'Check In Tool',
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.tool_id) newErrors.tool_id = 'Tool is required';
    if (!formData.user_id) newErrors.user_id = 'User is required';
    if (action === 'checkout' && !formData.expected_return_date) {
      newErrors.expected_return_date = 'Expected return date is required';
    }
    if (action === 'checkin' && !formData.condition) {
      newErrors.condition = 'Condition is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const url = action === 'checkout' ? '/api/tool-loans' : `/api/tool-loans/${formData.tool_id}/return`;
      const method = action === 'checkout' ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to process tool loan');

      onSuccess();
      onClose();
      setFormData({ tool_id: '', user_id: '', expected_return_date: '', condition: 'good', notes: '' });
    } catch (error) {
      console.error('Error processing tool loan:', error);
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
          <DialogTitle>{actionLabels[action]}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tool *</label>
            <select
              name="tool_id"
              value={formData.tool_id}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg ${errors.tool_id ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select tool</option>
              <option value="1">Impact Wrench</option>
              <option value="2">Torque Wrench</option>
              <option value="3">Socket Set</option>
              <option value="4">Drill</option>
            </select>
            {errors.tool_id && <p className="text-sm text-red-600 mt-1">{errors.tool_id}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To *</label>
            <select
              name="user_id"
              value={formData.user_id}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg ${errors.user_id ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select user</option>
              <option value="1">John Doe</option>
              <option value="2">Jane Smith</option>
              <option value="3">Bob Johnson</option>
            </select>
            {errors.user_id && <p className="text-sm text-red-600 mt-1">{errors.user_id}</p>}
          </div>

          {action === 'checkout' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Return Date *</label>
              <input
                type="date"
                name="expected_return_date"
                value={formData.expected_return_date}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.expected_return_date ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.expected_return_date && <p className="text-sm text-red-600 mt-1">{errors.expected_return_date}</p>}
            </div>
          )}

          {action === 'checkin' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition on Return *</label>
              <select
                name="condition"
                value={formData.condition}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border rounded-lg ${errors.condition ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
                <option value="damaged">Damaged</option>
              </select>
              {errors.condition && <p className="text-sm text-red-600 mt-1">{errors.condition}</p>}
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
              placeholder="Additional notes..."
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
                  Processing...
                </>
              ) : (
                action === 'checkout' ? 'Check Out' : 'Check In'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
