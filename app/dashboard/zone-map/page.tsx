'use client';

import { useState, useEffect } from 'react';
import { MapPin, Search, Filter, Box } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface BinLocation {
  id: string;
  zone: string;
  bin_location: string;
  max_weight_kg: number;
  description: string | null;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  current_stock: number;
  bin_location_id: string | null;
}

export default function ZoneMapPage() {
  // @ts-ignore - Supabase type issue
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');
  const [binLocations, setBinLocations] = useState<BinLocation[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBin, setSelectedBin] = useState<BinLocation | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [binsData, productsData] = await Promise.all([
        supabase.from('bin_locations').select('*').order('zone, bin_location'),
        supabase.from('products').select('*'),
      ]);
      setBinLocations(binsData.data || []);
      setProducts(productsData.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const zones = Array.from(new Set(binLocations.map(b => b.zone))).sort();
  const filteredBins = binLocations.filter(bin => {
    const matchesZone = selectedZone === 'all' || bin.zone === selectedZone;
    const matchesSearch = bin.zone.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         bin.bin_location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesZone && matchesSearch;
  });

  const getBinProducts = (binId: string) => {
    return products.filter(p => p.bin_location_id === binId);
  };

  const handleBinClick = (bin: BinLocation) => {
    setSelectedBin(bin);
    setShowDetailModal(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visual Zone Map</h1>
          <p className="text-gray-600 mt-1">Interactive warehouse layout</p>
        </div>
        <div className="p-8 text-center text-gray-500">Loading zone map...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visual Zone Map</h1>
          <p className="text-gray-600 mt-1">Interactive warehouse layout</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by zone or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Zones</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Zone Grid */}
      <div className="space-y-6">
        {selectedZone === 'all' ? (
          zones.map(zone => (
            <div key={zone} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                {zone}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {binLocations
                  .filter(b => b.zone === zone)
                  .map(bin => {
                    const binProducts = getBinProducts(bin.id);
                    return (
                      <div
                        key={bin.id}
                        onClick={() => handleBinClick(bin)}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{bin.bin_location}</span>
                          <Box className="h-4 w-4 text-gray-400" />
                        </div>
                        <p className="text-xs text-gray-600">{binProducts.length} items</p>
                        <p className="text-xs text-gray-500">Max: {bin.max_weight_kg}kg</p>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              {selectedZone}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredBins.map(bin => {
                const binProducts = getBinProducts(bin.id);
                return (
                  <div
                    key={bin.id}
                    onClick={() => handleBinClick(bin)}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{bin.bin_location}</span>
                      <Box className="h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-600">{binProducts.length} items</p>
                    <p className="text-xs text-gray-500">Max: {bin.max_weight_kg}kg</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bin Detail Modal */}
      {showDetailModal && selectedBin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {selectedBin.zone} - {selectedBin.bin_location}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Zone</p>
                  <p className="text-gray-900">{selectedBin.zone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Location</p>
                  <p className="text-gray-900">{selectedBin.bin_location}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Max Weight</p>
                  <p className="text-gray-900">{selectedBin.max_weight_kg} kg</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Description</p>
                  <p className="text-gray-900">{selectedBin.description || '-'}</p>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Products in this bin</h3>
                {getBinProducts(selectedBin.id).length > 0 ? (
                  <div className="space-y-2">
                    {getBinProducts(selectedBin.id).map(product => (
                      <div key={product.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-600">{product.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{product.current_stock}</p>
                          <p className="text-xs text-gray-600">in stock</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No products in this bin</p>
                )}
              </div>
              
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setShowDetailModal(false)}
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
