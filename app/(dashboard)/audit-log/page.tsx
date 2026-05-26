'use client';

import { useState } from 'react';
import { Search, Shield, AlertTriangle, Eye, Download } from 'lucide-react';

export default function AuditLogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const activities = [
    { id: 1, action: 'LOGIN', user: 'John Doe', table: 'users', timestamp: '2024-01-15 10:30:00', type: 'auth' },
    { id: 2, action: 'INSERT', user: 'Jane Smith', table: 'products', details: 'Added Brake Pad Set', timestamp: '2024-01-15 09:15:00', type: 'data' },
    { id: 3, action: 'UPDATE', user: 'John Doe', table: 'stock_movements', details: 'Stock take completed', timestamp: '2024-01-15 08:45:00', type: 'data' },
    { id: 4, action: 'SUSPICIOUS', user: 'Unknown', table: 'auth', details: 'Multiple failed login attempts', timestamp: '2024-01-15 08:30:00', type: 'alert' },
    { id: 5, action: 'DELETE', user: 'Jane Smith', table: 'products', details: 'Removed Oil Filter', timestamp: '2024-01-15 07:20:00', type: 'data' },
  ];

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.type === filter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-600 mt-1">System activity monitoring and fraud detection</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Download className="h-4 w-4" />
          Export Log
        </button>
      </div>

      {/* Anti-fraud Alert Banner */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <div>
          <p className="text-sm font-medium text-red-800">Security Alert</p>
          <p className="text-sm text-red-700">Multiple failed login attempts detected from IP 192.168.1.105</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, action, or table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Activities</option>
            <option value="auth">Authentication</option>
            <option value="data">Data Changes</option>
            <option value="alert">Security Alerts</option>
          </select>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-900">Activity Log</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredActivities.map((activity) => (
              <tr key={activity.id} className={`hover:bg-gray-50 ${activity.type === 'alert' ? 'bg-red-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{activity.timestamp}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{activity.user}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{activity.action}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{activity.table}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{activity.details || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    activity.type === 'alert' ? 'bg-red-100 text-red-700' :
                    activity.type === 'auth' ? 'bg-purple-100 text-purple-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {activity.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
