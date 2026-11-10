'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Search, LogOut, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  listToolLoans,
  listAssignableWorkers,
  checkOutTools,
  returnTools,
} from '@/lib/actions/tool-loans';
import { listToolProducts } from '@/lib/actions/products';
import type { ToolLoanDTO, ProfileOptionDTO } from '@/lib/types';

type ToolLoan = ToolLoanDTO;

interface Product {
  id: string;
  sku: string;
  name: string;
  item_type: string;
}

type Profile = ProfileOptionDTO;

export default function ToolLoansPage() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [toolLoans, setToolLoans] = useState<ToolLoan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showBulkCheckoutModal, setShowBulkCheckoutModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showBulkReturnModal, setShowBulkReturnModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<ToolLoan | null>(null);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    product_id: '',
    user_id: '',
    condition_out: 'good',
    notes: '',
    condition_in: 'good',
  });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // sync guard — blocks same-tick double-clicks
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchToolLoans();
    fetchProducts();
    fetchUsers();
  }, []);

  const fetchToolLoans = async () => {
    try {
      const result = await listToolLoans();
      if (!result.success) throw new Error(result.error);
      setToolLoans(result.data);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load tool loans' });
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const result = await listToolProducts();
      if (result.success) setProducts(result.data);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const result = await listAssignableWorkers();
      if (result.success) setUsers(result.data);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleCheckout = () => {
    setFormData({
      product_id: '',
      user_id: '',
      condition_out: 'good',
      notes: '',
      condition_in: 'good',
    });
    setShowCheckoutModal(true);
  };

  const handleBulkCheckout = () => {
    setSelectedToolIds([]);
    setFormData({
      product_id: '',
      user_id: '',
      condition_out: 'good',
      notes: '',
      condition_in: 'good',
    });
    setShowBulkCheckoutModal(true);
  };

  const handleBulkReturn = () => {
    setSelectedToolIds([]);
    setShowBulkReturnModal(true);
  };

  const handleReturn = (loan: ToolLoan) => {
    setSelectedLoan(loan);
    setFormData({
      ...formData,
      condition_in: 'good',
    });
    setShowReturnModal(true);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await checkOutTools({
        tool_product_ids: [formData.product_id],
        worker_profile_id: formData.user_id || null,
        condition_on_checkout: formData.condition_out,
        notes: formData.notes || null,
      });
      if (!result.success) throw new Error(result.error);
      setMessage({ type: 'success', text: 'Tool checked out successfully' });
      setShowCheckoutModal(false);
      fetchToolLoans();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Checkout failed' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !profile || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await returnTools({
        loan_ids: [selectedLoan.id],
        condition_on_return: formData.condition_in,
      });
      if (!result.success) throw new Error(result.error);
      setMessage({ type: 'success', text: 'Tool returned successfully' });
      setShowReturnModal(false);
      setSelectedLoan(null);
      fetchToolLoans();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Return failed' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleBulkCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || selectedToolIds.length === 0 || !formData.user_id || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await checkOutTools({
        tool_product_ids: selectedToolIds,
        worker_profile_id: formData.user_id,
        condition_on_checkout: formData.condition_out,
        notes: formData.notes || null,
      });
      if (!result.success) throw new Error(result.error);

      setMessage({ type: 'success', text: `${result.data.count} tools checked out successfully` });
      setShowBulkCheckoutModal(false);
      setSelectedToolIds([]);
      fetchToolLoans();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Bulk checkout failed' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleBulkReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || selectedToolIds.length === 0 || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await returnTools({
        loan_ids: selectedToolIds,
        condition_on_return: formData.condition_in,
      });
      if (!result.success) throw new Error(result.error);

      setMessage({ type: 'success', text: `${result.data.count} tools returned successfully` });
      setShowBulkReturnModal(false);
      setSelectedToolIds([]);
      fetchToolLoans();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Bulk return failed' });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const activeLoans = toolLoans.filter(loan => !loan.returned_at);
  const returnedLoans = toolLoans.filter(loan => loan.returned_at);

  const filteredActiveLoans = activeLoans.filter(loan =>
    loan.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loan.worker_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isOverdue = (loan: ToolLoan) => {
    if (!loan.checked_out_at) return false;
    const checkoutDate = new Date(loan.checked_out_at);
    const daysSinceCheckout = Math.floor((Date.now() - checkoutDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceCheckout > 7; // Consider overdue after 7 days
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tool Loans</h1>
          <p className="text-muted-foreground mt-1">Manage tool check-outs and returns</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCheckout}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Check Out Tool
          </button>
          <button
            onClick={handleBulkCheckout}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Bulk Check Out
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
          {message.text}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleCheckout}
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-muted hover:border-primary/40 transition-colors"
        >
          <div className="p-2 bg-info/10 rounded-lg">
            <LogOut className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-medium text-foreground">Check Out Tool</p>
            <p className="text-sm text-muted-foreground">Assign tool to staff member</p>
          </div>
        </button>
        <button
          onClick={handleBulkCheckout}
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-muted hover:border-info/30 transition-colors"
        >
          <div className="p-2 bg-info/10 rounded-lg">
            <Plus className="h-5 w-5 text-info" />
          </div>
          <div className="text-left">
            <p className="font-medium text-foreground">Bulk Check Out</p>
            <p className="text-sm text-muted-foreground">Check out multiple tools at once</p>
          </div>
        </button>
        <button
          onClick={handleBulkReturn}
          className="flex items-center gap-3 p-4 bg-card border border-border rounded-lg hover:bg-muted hover:border-success/40 transition-colors"
        >
          <div className="p-2 bg-success/10 rounded-lg">
            <ArrowLeft className="h-5 w-5 text-success" />
          </div>
          <div className="text-left">
            <p className="font-medium text-foreground">Bulk Return</p>
            <p className="text-sm text-muted-foreground">Return multiple tools at once</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by tool name or holder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Active Loans Table */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted">
          <h2 className="text-sm font-semibold text-foreground">Active Tool Loans ({activeLoans.length})</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading tool loans...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tool</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Holder</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Check Out Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Condition</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredActiveLoans.map((loan) => {
                const overdue = isOverdue(loan);
                return (
                  <tr key={loan.id} className={`hover:bg-muted ${overdue ? 'bg-destructive/10' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                      {loan.product_name || 'Unknown'} ({loan.product_sku || ''})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {loan.worker_name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {loan.checked_out_at ? new Date(loan.checked_out_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground capitalize">
                      {loan.condition_on_checkout || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${overdue ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                        {overdue ? 'Overdue' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleReturn(loan)}
                        className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Return
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredActiveLoans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No active tool loans found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-sidebar/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Check Out Tool</h2>
            </div>
            <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tool *</label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select Tool</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Assign To *</label>
                <select
                  required
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select User</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Condition *</label>
                <select
                  required
                  value={formData.condition_out}
                  onChange={(e) => setFormData({ ...formData, condition_out: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Optional notes..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Checking out…' : 'Check Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedLoan && (
        <div className="fixed inset-0 bg-sidebar/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Return Tool</h2>
            </div>
            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Tool</p>
                <p className="font-medium text-foreground">{selectedLoan.product_name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Checked Out To</p>
                <p className="text-foreground">{selectedLoan.worker_name || 'Unknown'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Return Condition *</label>
                <select
                  required
                  value={formData.condition_in}
                  onChange={(e) => setFormData({ ...formData, condition_in: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="damaged">Damaged</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-lg hover:bg-success/90 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  {submitting ? 'Returning…' : 'Return Tool'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Checkout Modal */}
      {showBulkCheckoutModal && (
        <div className="fixed inset-0 bg-sidebar/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Bulk Check Out Tools</h2>
            </div>
            <form onSubmit={handleBulkCheckoutSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Assign To *</label>
                <select
                  required
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select User</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Condition *</label>
                <select
                  required
                  value={formData.condition_out}
                  onChange={(e) => setFormData({ ...formData, condition_out: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Select Tools *</label>
                <div className="max-h-60 overflow-y-auto border border-border rounded-lg p-2 space-y-2">
                  {products.map(p => (
                    <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedToolIds.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedToolIds([...selectedToolIds, p.id]);
                          } else {
                            setSelectedToolIds(selectedToolIds.filter(id => id !== p.id));
                          }
                        }}
                        className="rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">{p.sku} - {p.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{selectedToolIds.length} tools selected</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Optional notes..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBulkCheckoutModal(false)}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedToolIds.length === 0 || submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Checking out…' : `Check Out ${selectedToolIds.length} Tools`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Return Modal */}
      {showBulkReturnModal && (
        <div className="fixed inset-0 bg-sidebar/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-semibold text-foreground">Bulk Return Tools</h2>
            </div>
            <form onSubmit={handleBulkReturnSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Select Active Loans to Return *</label>
                <div className="max-h-60 overflow-y-auto border border-border rounded-lg p-2 space-y-2">
                  {activeLoans.map(loan => (
                    <label key={loan.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedToolIds.includes(loan.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedToolIds([...selectedToolIds, loan.id]);
                          } else {
                            setSelectedToolIds(selectedToolIds.filter(id => id !== loan.id));
                          }
                        }}
                        className="rounded border-input text-success focus:ring-success"
                      />
                      <span className="text-sm text-foreground">{loan.product_name || 'Unknown'} - {loan.worker_name || 'Unknown'}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{selectedToolIds.length} loans selected</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Return Condition *</label>
                <select
                  required
                  value={formData.condition_in}
                  onChange={(e) => setFormData({ ...formData, condition_in: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="damaged">Damaged</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBulkReturnModal(false)}
                  className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedToolIds.length === 0 || submitting}
                  className="px-4 py-2 bg-success text-success-foreground rounded-lg hover:bg-success/90 disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Returning…' : `Return ${selectedToolIds.length} Tools`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
