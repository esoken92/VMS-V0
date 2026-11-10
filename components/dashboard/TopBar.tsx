/**
 * TopBar Component
 * Top navigation bar with branding and user menu
 */

'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import UserMenu from './UserMenu';
import { Menu, Bell, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { isImpersonating } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header
      className={`
        sticky top-0 z-30 bg-white border-b border-gray-200
        ${isImpersonating ? 'border-yellow-400' : 'border-gray-200'}
      `}
    >
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <p className="text-sm font-medium text-yellow-800">
            🎭 Viewing as another user - changes will be logged
          </p>
        </div>
      )}

      {/* Main TopBar */}
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="h-6 w-6 text-gray-600" />
          </button>

          {/* Page Title */}
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              VMS Inventory Management
            </h1>
            <p className="text-xs text-gray-500">Heavy-Duty Truck Parts</p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="
                relative p-2 text-gray-600 hover:text-gray-900
                hover:bg-gray-100 rounded-lg transition-colors
              "
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="p-4 hover:bg-gray-50 cursor-pointer">
                    <p className="text-sm font-medium text-gray-900">
                      Low Stock Alert
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      5 products below minimum threshold
                    </p>
                  </div>
                  <div className="p-4 hover:bg-gray-50 cursor-pointer">
                    <p className="text-sm font-medium text-gray-900">
                      Overdue Tool Return
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      2 tools overdue for return
                    </p>
                  </div>
                </div>
                <div className="p-4 border-t border-gray-100 text-center">
                  <button className="text-xs font-medium text-primary hover:text-primary/80">
                    View All Notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-gray-200" />

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
