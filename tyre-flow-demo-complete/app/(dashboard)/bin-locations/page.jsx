/**
 * Bin Locations Page
 * Warehouse location and zone management
 */

'use client';

import { MapPin, Plus, Search } from 'lucide-react';

export default function BinLocationsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bin Locations</h1>
          <p className="text-gray-600 mt-1">
            Manage warehouse zones and bin locations
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Location
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {['Zone A', 'Zone B', 'Zone C', 'Zone D'].map((zone, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:shadow-lg transition cursor-pointer"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-2xl">📍</div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                {(i + 1) * 5} BINS
              </span>
            </div>
            <h3 className="font-bold text-gray-900">{zone}</h3>
            <p className="text-xs text-gray-500 mt-2">
              Capacity: — / 10,000 lbs
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search locations..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-6 hover:bg-gray-50 transition flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Bin {String.fromCharCode(64 + Math.ceil(i / 2))}-{i}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Zone {String.fromCharCode(64 + Math.ceil(i / 2))} • {Math.random() * 100 | 0}% Full
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {(Math.random() * 50 | 0) * 100} lbs
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
