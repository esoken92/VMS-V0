/**
 * Stock Movements Page
 * Track inbound, outbound, and scrap transactions
 */

'use client';

import { TrendingUp, Plus, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function StockMovementsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Stock Movements</h1>
          <p className="text-gray-600 mt-1">
            Manage inbound, outbound, and scrap transactions
          </p>
        </div>
        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Movement
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link
          href="#"
          className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:shadow-lg transition"
        >
          <div className="text-2xl mb-2">📥</div>
          <h3 className="font-bold text-gray-900">Inbound</h3>
          <p className="text-sm text-gray-600 mt-1">Receive new stock</p>
        </Link>
        <Link
          href="#"
          className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:shadow-lg transition"
        >
          <div className="text-2xl mb-2">📤</div>
          <h3 className="font-bold text-gray-900">Outbound</h3>
          <p className="text-sm text-gray-600 mt-1">Ship inventory</p>
        </Link>
        <Link
          href="#"
          className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:shadow-lg transition"
        >
          <div className="text-2xl mb-2">🗑️</div>
          <h3 className="font-bold text-gray-900">Scrap</h3>
          <p className="text-sm text-gray-600 mt-1">Record damaged items</p>
        </Link>
      </div>

      {/* Recent Movements */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search movements..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Movements List */}
        <div className="divide-y divide-gray-200">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="p-6 hover:bg-gray-50 transition flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="text-xl">
                    {i % 2 === 0 ? '📥' : i % 3 === 0 ? '📤' : '🗑️'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      Movement #{i}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {i % 2 === 0
                        ? 'Inbound from Supplier'
                        : i % 3 === 0
                          ? 'Outbound to Customer'
                          : 'Scrap Recording'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">SKU-00{i}</p>
                <p className="text-sm text-gray-500">Qty: 50 units</p>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium mt-2 inline-block ${
                    i % 2 === 0
                      ? 'bg-green-100 text-green-700'
                      : i % 3 === 0
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {i % 2 === 0 ? 'Inbound' : i % 3 === 0 ? 'Outbound' : 'Scrap'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
