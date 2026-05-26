'use client';

import { useState } from 'react';
import { Plus, Search, ClipboardList, CheckCircle, Clock } from 'lucide-react';

export default function StockTakesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Takes</h1>
          <p className="text-gray-600 mt-1">Perform blind inventory counts</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" />
          Start New Stock Take
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ClipboardList className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Start Blind Count</p>
            <p className="text-sm text-gray-600">Begin new stock take session</p>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Complete Stock Take</p>
            <p className="text-sm text-gray-600">Finalize and submit counts</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search stock takes by ID, zone, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Stock Takes Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">ST-2024-001</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Zone A</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">2024-01-15 09:00</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">45/120</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">In Progress</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button className="text-blue-600 hover:text-blue-700 font-medium">Continue</button>
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">ST-2024-002</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Zone B</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">2024-01-14 14:30</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0/85</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded">Pending</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button className="text-blue-600 hover:text-blue-700 font-medium">Start</button>
              </td>
            </tr>
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">ST-2024-003</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Zone C</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">2024-01-13 10:00</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">95/95</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Completed</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button className="text-blue-600 hover:text-blue-700 font-medium">View</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
