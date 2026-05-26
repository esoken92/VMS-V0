'use client';

import { useState } from 'react';
import { Plus, Search, MapPin, AlertTriangle, Package } from 'lucide-react';

export default function BinLocationsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bin Locations</h1>
          <p className="text-gray-600 mt-1">Manage warehouse zones and bins</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" />
          Add Bin
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MapPin className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">View Zone Map</p>
            <p className="text-sm text-gray-600">Visual warehouse layout</p>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Check Capacity</p>
            <p className="text-sm text-gray-600">Review bin weight limits</p>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors">
          <div className="p-2 bg-green-100 rounded-lg">
            <Package className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Generate Pick Route</p>
            <p className="text-sm text-gray-600">Optimized picking path</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by zone, row, or column..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Bins Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Column</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity (kg)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Weight</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Zone A</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">01</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">01</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">500</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">320</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Available</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button className="text-blue-600 hover:text-blue-700 font-medium">Edit</button>
              </td>
            </tr>
            <tr className="hover:bg-gray-50 bg-yellow-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Zone A</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">02</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">05</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">500</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">520</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Over Capacity</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button className="text-blue-600 hover:text-blue-700 font-medium">Edit</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
