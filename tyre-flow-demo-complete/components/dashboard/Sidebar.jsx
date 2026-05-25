/**
 * Sidebar Navigation Component
 * Left navigation panel with menu items
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  navigationConfig,
  adminOnlyNavigation,
  superAdminNavigation,
} from '@/lib/navigation-config';
import { ChevronRight } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();

  // Determine visible menu items based on role
  const visibleItems = [
    ...navigationConfig,
    ...(['super_admin', 'admin'].includes(profile?.role) ? adminOnlyNavigation : []),
    ...(['super_admin'].includes(profile?.role) ? superAdminNavigation : []),
  ];

  const isActive = (href) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden md:flex w-64 bg-gray-900 text-white flex-col h-screen sticky top-0 z-40">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-800">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="text-2xl">📦</div>
          <div>
            <h1 className="text-lg font-bold">Warehouse</h1>
            <p className="text-xs text-gray-400">IMS</p>
          </div>
        </Link>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                group flex items-center justify-between px-4 py-3 rounded-lg
                transition-all duration-200 relative
                ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
              title={item.description}
            >
              <div className="flex items-center gap-3 flex-1">
                <span className="text-lg">{item.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.label}</p>
                  <p
                    className={`text-xs ${
                      active ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </div>
              {active && (
                <ChevronRight className="h-4 w-4 text-blue-200 group-hover:translate-x-1 transition-transform" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Role Badge */}
      <div className="border-t border-gray-800 p-4">
        <div className="bg-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Current Role</p>
          <p className="text-sm font-bold text-blue-400 uppercase">
            {profile?.role?.replace('_', ' ')}
          </p>
        </div>
      </div>
    </aside>
  );
}
