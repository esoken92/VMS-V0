'use client';

import { useState } from 'react';
import { Plus, Search, ArrowDown, ArrowUp, Trash2 } from 'lucide-react';

export default function StockMovementsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Movements</h1>
          <p className="text-gray-600 mt-1">Track inbound, outbound, and scrap movements</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" />
          Record Movement
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors">
          <div className="p-2 bg-green-100 rounded-lg">
            <ArrowDown className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Inbound Receipt</p>
            <p className="text-sm text-gray-600">Receive stock from supplier</p>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ArrowUp className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Outbound Issue</p>
            <p className="text-sm text-gray-600">Issue stock to customer</p>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors">
          <div className="p-2 bg-red-100 rounded-lg">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Scrap Movement</p>
            <p className="text-sm text-gray-600">Record damaged/defective items</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search movements by product, reference, or user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2024-01-15 10:30</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Inbound</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Brake Pad Set</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">+50</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">PO-2024-001</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">John Doe</td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2024-01-15 09:15</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">Outbound</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Oil Filter</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">-25</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">SO-2024-045</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Jane Smith</td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2024-01-14 16:45</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Scrap</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Brake Pad Set</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">-5</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">SCR-2024-012</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">John Doe</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
