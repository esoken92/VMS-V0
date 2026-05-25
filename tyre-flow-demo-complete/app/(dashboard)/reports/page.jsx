/**
 * Reports Page
 * Analytics and insights (Admin Only)
 */

'use client';

import { BarChart3, TrendingUp, Calendar } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">
            Analytics, insights, and operational metrics
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date Range
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { label: 'Total Movements', value: '—', trend: '↑ 12%' },
          { label: 'Avg Stock Level', value: '—', trend: '→ 0%' },
          { label: 'Inventory Accuracy', value: '—', trend: '↑ 5%' },
          { label: 'Audit Entries', value: '—', trend: '→ 0%' },
        ].map((kpi, i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow p-6 border border-gray-200"
          >
            <p className="text-sm text-gray-600">{kpi.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{kpi.value}</p>
            <p className="text-xs text-green-600 mt-2">{kpi.trend}</p>
          </div>
        ))}
      </div>

      {/* Report Sections */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Stock Movement Report */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Stock Movements</h2>
              <TrendingUp className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Movement breakdown by type (last 30 days)
            </p>
            <div className="space-y-3">
              {[
                { label: 'Inbound', count: 45, color: 'bg-green-500' },
                { label: 'Outbound', count: 38, color: 'bg-blue-500' },
                { label: 'Scrap', count: 8, color: 'bg-red-500' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-700">
                      {item.label}
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {item.count}
                    </p>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color}`}
                      style={{
                        width: `${Math.random() * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Inventory Variance Report */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                Inventory Variance
              </h2>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Variance by product category (last stock take)
            </p>
            <div className="space-y-3">
              {[
                { label: 'Tires', variance: 0.2, color: 'bg-yellow-500' },
                { label: 'Fluids', variance: -0.1, color: 'bg-green-500' },
                { label: 'Tools', variance: 1.5, color: 'bg-red-500' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-700">
                      {item.label}
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        item.variance > 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {item.variance > 0 ? '+' : ''}{item.variance}%
                    </p>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color}`}
                      style={{
                        width: `${Math.abs(item.variance) * 20}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Reports List */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Generate Reports</h2>
          <p className="text-sm text-gray-600 mt-1">
            Run detailed reports for specific time periods
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            'Stock Movement Summary',
            'Inventory Valuation',
            'Variance Analysis',
            'Tool Loan Status',
            'Audit Trail',
          ].map((report, i) => (
            <div
              key={i}
              className="p-6 hover:bg-gray-50 transition flex items-center justify-between cursor-pointer"
            >
              <p className="font-medium text-gray-900">{report}</p>
              <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Generate →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
