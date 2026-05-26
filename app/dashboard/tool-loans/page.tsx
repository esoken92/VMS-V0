'use client';

import { useState } from 'react';
import { Plus, Search, LogOut, AlertCircle } from 'lucide-react';

export default function ToolLoansPage() {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tool Loans</h1>
          <p className="text-gray-600 mt-1">Manage tool check-outs and returns</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="h-4 w-4" />
          Check Out Tool
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors">
          <div className="p-2 bg-blue-100 rounded-lg">
            <LogOut className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Check Out Tool</p>
            <p className="text-sm text-gray-600">Assign tool to staff member</p>
          </div>
        </button>
        <button className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors">
          <div className="p-2 bg-green-100 rounded-lg">
            <AlertCircle className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-left">
            <p className="font-medium text-gray-900">Return Tool</p>
            <p className="text-sm text-gray-600">Record tool return with condition</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by tool name, holder, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Active Loans Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-900">Active Tool Loans</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tool</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holder</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Impact Wrench</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">John Doe</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">2024-01-10</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">Active</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button className="text-blue-600 hover:text-blue-700 font-medium">Return</button>
              </td>
            </tr>
            <tr className="hover:bg-gray-50 bg-red-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Torque Wrench</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Jane Smith</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">2024-01-05</td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">Overdue</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <button className="text-blue-600 hover:text-blue-700 font-medium">Return</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
