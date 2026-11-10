'use client';

import { useState, useEffect } from 'react';
import { Search, Shield, AlertTriangle, Eye, Download } from 'lucide-react';
import { listActivityLogs } from '@/lib/actions/audit-log';
import type { ActivityLogDTO } from '@/lib/types';

type ActivityLog = ActivityLogDTO;

export default function AuditLogPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  useEffect(() => {
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    try {
      const result = await listActivityLogs(100);
      if (result.success) setActivityLogs(result.data);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ['Timestamp', 'User', 'Action', 'Table', 'Record ID', 'IP Address'];
    const rows = activityLogs.map(log => [
      log.created_at ?? '',
      log.user_name || 'Unknown',
      log.action,
      log.table_name || '-',
      log.record_id || '-',
      log.ip_address || '-',
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleViewDetails = (log: ActivityLog) => {
    setSelectedLog(log);
    setShowDetailModal(true);
  };

  const filteredLogs = activityLogs.filter(log => {
    const matchesSearch =
      log.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.table_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === 'all') return matchesSearch;
    return matchesSearch && log.action.toLowerCase() === filter.toLowerCase();
  });

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('insert') || actionLower.includes('create')) return 'bg-green-100 text-green-700';
    if (actionLower.includes('update') || actionLower.includes('edit')) return 'bg-blue-100 text-blue-700';
    if (actionLower.includes('delete') || actionLower.includes('remove')) return 'bg-red-100 text-red-700';
    if (actionLower.includes('login') || actionLower.includes('auth')) return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-600 mt-1">System activity monitoring</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export Log
        </button>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Actions</option>
            <option value="INSERT">Insert</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="LOGIN">Login</option>
          </select>
        </div>
      </div>

      {/* Activity Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold text-gray-900">Activity Log</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading activity logs...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Table</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {log.user_name || 'Unknown'}
                    {log.impersonated_by_name ? (
                      <span className="block text-xs text-yellow-700">
                        via {log.impersonated_by_name}
                      </span>
                    ) : null}
                  </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.table_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {log.ip_address || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleViewDetails(log)}
                        className="text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No activity logs found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Activity Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Timestamp</p>
                  <p className="text-gray-900">{selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">User</p>
                  <p className="text-gray-900">{selectedLog.user_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Action</p>
                  <p className="text-gray-900">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Table</p>
                  <p className="text-gray-900">{selectedLog.table_name || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Record ID</p>
                  <p className="text-gray-900">{selectedLog.record_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">IP Address</p>
                  <p className="text-gray-900">{selectedLog.ip_address || '-'}</p>
                </div>
              </div>
              {!!selectedLog.old_values && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Old Values</p>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedLog.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {!!selectedLog.new_values && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">New Values</p>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(selectedLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
              <div className="flex justify-end pt-4">
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
