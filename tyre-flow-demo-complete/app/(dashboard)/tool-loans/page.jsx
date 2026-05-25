/**
 * Tool Loans Page
 * Manage tool checkouts and returns
 */

'use client';

import { Wrench, Plus, AlertTriangle } from 'lucide-react';

export default function ToolLoansPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tool Loans</h1>
          <p className="text-gray-600 mt-1">
            Track tool checkouts, returns, and overdue items
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Checkout Tool
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { label: 'Active Loans', value: '—', icon: '✓' },
          { label: 'Overdue Tools', value: '—', icon: '!' },
          { label: 'Returned Today', value: '—', icon: '↩️' },
        ].map((stat, i) => (
          <div
            key={i}
            className={`bg-white rounded-lg shadow p-6 border ${
              stat.icon === '!'
                ? 'border-red-200 bg-red-50'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${stat.icon === '!' ? 'text-red-600' : 'text-gray-600'}`}>
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stat.value}
                </p>
              </div>
              <div className={`text-3xl ${stat.icon === '!' ? 'text-red-600' : ''}`}>
                {stat.icon === '!' && <AlertTriangle className="h-8 w-8" />}
                {stat.icon !== '!' && stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="font-bold text-gray-900">Active Tool Loans</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-6 hover:bg-gray-50 transition flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Wrench className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">Tool #{i}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Checked out by John Doe
                    </p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Due in 2 days</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
