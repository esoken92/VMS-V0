'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { Package, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {profile?.full_name || 'User'}
        </h1>
        <p className="text-gray-600 mt-1">
          Here&apos;s what&apos;s happening with your inventory today
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/dashboard/inventory" className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">1,234</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2">+12% from last month</p>
        </Link>

        <Link href="/dashboard/stock-movements" className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-green-300 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Movements</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">456</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2">+8% from last week</p>
        </Link>

        <Link href="/dashboard/inventory" className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-yellow-300 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock Alerts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">23</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-xs text-red-600 mt-2">+5 from yesterday</p>
        </Link>

        <Link href="/dashboard/tool-loans" className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Tool Loans</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">18</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">2 overdue</p>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/stock-movements" className="p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left">
            <div className="text-2xl mb-2">📦</div>
            <p className="font-medium text-gray-900">Record Stock Movement</p>
            <p className="text-sm text-gray-600">Add inbound or outbound stock</p>
          </Link>
          <Link href="/dashboard/tool-loans" className="p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors text-left">
            <div className="text-2xl mb-2">🔧</div>
            <p className="font-medium text-gray-900">Tool Check-Out</p>
            <p className="text-sm text-gray-600">Assign tool to staff member</p>
          </Link>
          <Link href="/dashboard/stock-takes" className="p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors text-left">
            <div className="text-2xl mb-2">📋</div>
            <p className="font-medium text-gray-900">Start Stock Take</p>
            <p className="text-sm text-gray-600">Begin blind inventory count</p>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Stock received: Brake Pads</p>
              <p className="text-xs text-gray-600">2 hours ago by John Doe</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Tool checked out: Impact Wrench</p>
              <p className="text-xs text-gray-600">3 hours ago by Jane Smith</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Low stock alert: Oil Filter</p>
              <p className="text-xs text-gray-600">5 hours ago by System</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
