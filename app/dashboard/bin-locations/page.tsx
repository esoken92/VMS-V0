'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, MapPin, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  listBinLocations,
  upsertBinLocation,
  deleteBinLocation,
} from '@/lib/actions/bin-locations';
import type { BinLocationDTO } from '@/lib/types';

type BinLocation = BinLocationDTO;

export default function BinLocationsPage() {
  const { hasRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [binLocations, setBinLocations] = useState<BinLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBin, setEditingBin] = useState<BinLocation | null>(null);
  const [deleteBin, setDeleteBin] = useState<BinLocation | null>(null);
  const [formData, setFormData] = useState({
    zone: '',
    bin_location: '',
    max_weight_kg: 0,
    description: '',
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canEdit = hasRole(['admin', 'super_admin']);
  const canDelete = hasRole(['admin', 'super_admin']);

  useEffect(() => {
    fetchBinLocations();
  }, []);

  const fetchBinLocations = async () => {
    try {
      const result = await listBinLocations();
      if (!result.success) throw new Error(result.error);
      setBinLocations(result.data);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load bin locations' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddBin = () => {
    setEditingBin(null);
    setFormData({
      zone: '',
      bin_location: '',
      max_weight_kg: 0,
      description: '',
    });
    setShowModal(true);
  };

  const handleEditBin = (bin: BinLocation) => {
    setEditingBin(bin);
    setFormData({
      zone: bin.zone,
      bin_location: bin.bin_location,
      max_weight_kg: bin.max_weight_kg,
      description: bin.description || '',
    });
    setShowModal(true);
  };

  const handleDeleteBin = async () => {
    if (!deleteBin) return;
    try {
      const result = await deleteBinLocation(deleteBin.id);
      if (!result.success) throw new Error(result.error);
      setMessage({ type: 'success', text: 'Bin location deleted successfully' });
      setDeleteBin(null);
      fetchBinLocations();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Delete failed' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await upsertBinLocation({
        ...(editingBin ? { id: editingBin.id } : {}),
        zone: formData.zone,
        bin_location: formData.bin_location,
        max_weight_kg: formData.max_weight_kg,
        description: formData.description || null,
      });
      if (!result.success) throw new Error(result.error);
      setMessage({
        type: 'success',
        text: editingBin
          ? 'Bin location updated successfully'
          : 'Bin location added successfully',
      });
      setShowModal(false);
      fetchBinLocations();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Save failed' });
    }
  };

  const filteredBins = binLocations.filter(bin =>
    bin.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bin.bin_location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bin Locations</h1>
          <p className="text-gray-600 mt-1">Manage warehouse zones and bins</p>
        </div>
        {canEdit && (
          <button
            onClick={handleAddBin}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Bin
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors">
          <div className="p-2 bg-green-100 rounded-lg">
            <MapPin className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">View Zone Map</p>
            <p className="text-sm text-gray-600">Visual warehouse layout (Coming Soon)</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by zone or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Bin Locations Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading bin locations...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity (kg)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBins.map((bin) => (
                <tr key={bin.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{bin.zone}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bin.bin_location}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{bin.max_weight_kg}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{bin.description || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => handleEditBin(bin)}
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => setDeleteBin(bin)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No bin locations found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingBin ? 'Edit Bin Location' : 'Add Bin Location'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone *</label>
                <input
                  type="text"
                  required
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., Zone A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bin Location *</label>
                <input
                  type="text"
                  required
                  value={formData.bin_location}
                  onChange={(e) => setFormData({ ...formData, bin_location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., 01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Weight (kg) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.max_weight_kg}
                  onChange={(e) => setFormData({ ...formData, max_weight_kg: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Optional description..."
                />
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
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  {editingBin ? 'Update' : 'Add'} Bin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteBin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Delete Bin Location</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete &quot;{deleteBin.zone}-{deleteBin.bin_location}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteBin(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteBin}
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
