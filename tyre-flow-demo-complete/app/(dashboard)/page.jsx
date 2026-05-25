/**
 * Dashboard Home Page
 * Main dashboard overview with quick stats and recent activity
 */

'use client';

import { useAuth } from '@/hooks/useAuth';
import { Activity, Users, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-8 text-white">
        <h1 className="text-4xl font-bold mb-2">
          Welcome back, {profile?.full_name}!
        </h1>
        <p className="text-blue-100">
          Role: <span className="font-semibold">{profile?.role?.replace('_', ' ')}</span>
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        {[
          {
            label: 'Total Products',
            value: '—',
            icon: '📦',
            href: '/dashboard/inventory',
          },
          {
            label: 'Low Stock Items',
            value: '—',
            icon: '⚠️',
            href: '/dashboard/inventory?filter=low-stock',
          },
          {
            label: 'Active Tool Loans',
            value: '—',
            icon: '🔧',
            href: '/dashboard/tool-loans',
          },
          {
            label: 'Recent Movements',
            value: '—',
            icon: '📊',
            href: '/dashboard/stock-movements',
          },
        ].map((stat, i) => (
          <Link
            key={i}
            href={stat.href}
            className="bg-white rounded-lg shadow p-6 border border-gray-200 hover:shadow-lg hover:border-blue-200 transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {stat.value}
                </p>
              </div>
              <div className="text-3xl">{stat.icon}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Action Cards */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                label: 'Search Products',
                desc: 'Find and view product details',
                icon: '🔍',
                href: '/dashboard/inventory',
              },
              {
                label: 'New Stock Movement',
                desc: 'Record inbound, outbound, or scrap',
                icon: '📥',
                href: '/dashboard/stock-movements',
              },
              {
                label: 'Start Stock Take',
                desc: 'Begin physical count',
                icon: '📋',
                href: '/dashboard/stock-takes',
              },
              {
                label: 'Tool Checkout',
                desc: 'Manage tool loans',
                icon: '🔧',
                href: '/dashboard/tool-loans',
              },
            ].map((action, i) => (
              <Link
                key={i}
                href={action.href}
                className="bg-white rounded-lg shadow p-4 border border-gray-200 hover:shadow-lg hover:border-blue-200 transition"
              >
                <div className="text-2xl mb-2">{action.icon}</div>
                <p className="font-medium text-gray-900">{action.label}</p>
                <p className="text-xs text-gray-500 mt-1">{action.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900">System Status</h2>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200 space-y-4">
            {[
              { label: 'Database', status: 'Connected', color: 'green' },
              { label: 'Service Worker', status: 'Active', color: 'green' },
              { label: 'Offline Mode', status: 'Ready', color: 'blue' },
              {
                label: 'Auth Session',
                status: 'Valid',
                color: 'green',
              },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{item.label}</p>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    item.color === 'green'
                      ? 'bg-green-100 text-green-700'
                      : item.color === 'red'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Latest warehouse operations and stock changes
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-6 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">
                      {i % 2 === 0 ? '📥' : i % 3 === 0 ? '📤' : '🔄'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {i % 2 === 0
                          ? 'Inbound Received'
                          : i % 3 === 0
                            ? 'Outbound Shipped'
                            : 'Stock Adjusted'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        SKU-00{i} • 50 units • Zone {String.fromCharCode(64 + i)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      i % 2 === 0
                        ? 'bg-green-100 text-green-700'
                        : i % 3 === 0
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {i % 2 === 0 ? 'Inbound' : i % 3 === 0 ? 'Outbound' : 'Adjustment'}
                  </span>
                  <p className="text-xs text-gray-500 mt-2">{i} hours ago</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 text-center border-t border-gray-200 bg-gray-50">
          <Link
            href="/dashboard/audit-log"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View Full Activity Log →
          </Link>
        </div>
      </div>

      {/* Admin Section */}
      {(['super_admin', 'admin'].includes(profile?.role)) && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Users className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-purple-900 mb-2">
                Admin Dashboard
              </h3>
              <p className="text-purple-800 mb-4">
                As an admin, you have access to additional features:
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/reports"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                >
                  📈 View Reports
                </Link>
                <Link
                  href="/dashboard/audit-log"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                >
                  📝 Audit Logs
                </Link>
                {profile?.role === 'super_admin' && (
                  <>
                    <Link
                      href="/dashboard/users"
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                    >
                      👥 User Management
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition"
                    >
                      ⚙️ Settings
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
