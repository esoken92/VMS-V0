/**
 * Inventory Dashboard Page
 * Main inventory management page
 */

'use client';

import { useAuth } from '@/hooks/useAuth';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  Clock,
  Plus,
  Search,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

export default function InventoryPage() {
  const { profile } = useAuth();

  // Placeholder stats - will be replaced with real data from Supabase
  const stats = [
    {
      label: 'Total Products',
      value: '—',
      icon: Package,
      color: 'blue',
      href: '/dashboard/inventory',
    },
    {
      label: 'Low Stock Items',
      value: '—',
      icon: AlertTriangle,
      color: 'red',
      href: '/dashboard/inventory?filter=low-stock',
    },
    {
      label: 'Recent Movements',
      value: '—',
      icon: TrendingUp,
      color: 'green',
      href: '/dashboard/stock-movements',
    },
    {
      label: 'Pending Counts',
      value: '—',
      icon: Clock,
      color: 'yellow',
      href: '/dashboard/stock-takes',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-600 mt-1">
            Manage products, stock levels, and warehouse locations
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </button>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Product
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorMap = {
            blue: 'bg-blue-50 text-blue-600 border-blue-200',
            red: 'bg-red-50 text-red-600 border-red-200',
            green: 'bg-green-50 text-green-600 border-green-200',
            yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
          };

          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="
                bg-white rounded-lg shadow p-6 border border-gray-200
                hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer
              "
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 font-medium">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg border ${colorMap[stat.color]}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Content Sections */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href="/dashboard/inventory"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-blue-50 text-gray-700 hover:text-blue-600 transition"
              >
                <Package className="h-5 w-5" />
                <span className="font-medium">Search Products</span>
              </Link>
              <Link
                href="/dashboard/stock-movements"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-green-50 text-gray-700 hover:text-green-600 transition"
              >
                <TrendingUp className="h-5 w-5" />
                <span className="font-medium">New Stock Movement</span>
              </Link>
              <Link
                href="/dashboard/stock-takes"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-yellow-50 text-gray-700 hover:text-yellow-600 transition"
              >
                <Clock className="h-5 w-5" />
                <span className="font-medium">Start Stock Take</span>
              </Link>
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-4">System Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Database</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Service Worker</span>
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Offline Mode</span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                  Ready
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Products Table Preview */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Products</h2>
              <Link
                href="/dashboard/inventory"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All →
              </Link>
            </div>
          </div>

          {/* Search Bar */}
          <div className="p-6 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                className="
                  w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                "
              />
            </div>
          </div>

          {/* Products List Placeholder */}
          <div className="divide-y divide-gray-200">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-6 hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      Product Name {i}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      SKU: SKU-00{i} • Category: Tires
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">— units</p>
                    <p className="text-xs text-gray-500">
                      Location: Bin A-{i}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 text-center border-t border-gray-200">
            <Link
              href="/dashboard/inventory"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Load More Products
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Recent Activity</h2>
          <p className="text-sm text-gray-600 mt-1">
            Latest warehouse movements and stock changes
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    Stock Movement #{i}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Received 50 units • SKU-00{i}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    Inbound
                  </span>
                  <p className="text-xs text-gray-500 mt-2">2 hours ago</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 text-center border-t border-gray-200">
          <Link
            href="/dashboard/audit-log"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View Full Activity Log
          </Link>
        </div>
      </div>

      {/* Getting Started for New Users */}
      {profile?.role === 'picker' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-3">
            Welcome to Warehouse IMS!
          </h3>
          <p className="text-blue-800 mb-4">
            You're all set to start managing inventory. Here are some quick tips:
          </p>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✓ Use barcode scanning for fast stock entry</li>
            <li>✓ Search products by SKU or name</li>
            <li>✓ Record stock movements for audit trail</li>
            <li>✓ Check low stock alerts for timely replenishment</li>
          </ul>
        </div>
      )}
    </div>
  );
}
