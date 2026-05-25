/**
 * Stock Takes Page
 * Physical inventory count management
 */

'use client';

import { Clock, Plus, Search } from 'lucide-react';

export default function StockTakesPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Takes</h1>
          <p className="text-gray-600 mt-1">
            Physical inventory counts and variance reconciliation
          </p>
        </div>
        <button className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Start Count
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Active Counts', value: '—', icon: '📋' },
          { label: 'Completed', value: '—', icon: '✅' },
          { label: 'Variance Found', value: '—', icon: '⚠️' },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stat.value}
                </p>
              </div>
              <div className="text-3xl">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search stock takes..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 hover:bg-gray-50 transition flex items-center justify-between"
            >
              <div className="flex-1">
                <p className="font-medium text-gray-900">Stock Take #{i}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Zone {String.fromCharCode(64 + i)} • Started 2 days ago
                </p>
              </div>
              <div className="text-right">
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                  In Progress
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
