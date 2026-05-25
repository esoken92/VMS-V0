/**
 * User Menu Dropdown Component
 * Profile menu with settings and logout
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import {
  LogOut,
  Settings,
  User,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';

export default function UserMenu() {
  const { profile, logout, isImpersonating, exitImpersonation } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (confirm('Are you sure you want to sign out?')) {
      setIsOpen(false);
      await logout();
    }
  };

  const handleImpersonationExit = async () => {
    setIsOpen(false);
    await exitImpersonation();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-3 px-4 py-2 rounded-lg
          hover:bg-gray-100 transition-colors
          focus:outline-none focus:ring-2 focus:ring-blue-500
        "
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-gray-900">
            {profile?.full_name}
          </p>
          <p className="text-xs text-gray-500">{profile?.role?.replace('_', ' ')}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
            absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg
            border border-gray-200 z-50 overflow-hidden
          "
        >
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-semibold text-gray-900">
              {profile?.full_name}
            </p>
            <p className="text-xs text-gray-500">{profile?.email}</p>
            <div className="mt-2 flex gap-2">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                {profile?.role?.replace('_', ' ')}
              </span>
              {profile?.is_active === false && (
                <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                  Inactive
                </span>
              )}
            </div>
          </div>

          {/* Impersonation Banner */}
          {isImpersonating && (
            <div className="px-4 py-3 border-b border-yellow-200 bg-yellow-50">
              <p className="text-xs font-medium text-yellow-800 mb-2">
                🎭 Super Admin Mode Active
              </p>
              <button
                onClick={handleImpersonationExit}
                className="
                  w-full px-3 py-1 text-xs font-medium
                  bg-yellow-600 text-white rounded
                  hover:bg-yellow-700 transition-colors
                "
              >
                Exit View As Mode
              </button>
            </div>
          )}

          {/* Menu Items */}
          <div className="py-2">
            <Link
              href="/dashboard/profile"
              onClick={() => setIsOpen(false)}
              className="
                flex items-center gap-3 px-4 py-2 text-sm text-gray-700
                hover:bg-gray-100 transition-colors
              "
            >
              <User className="h-4 w-4 text-gray-400" />
              My Profile
            </Link>

            <Link
              href="/dashboard/settings"
              onClick={() => setIsOpen(false)}
              className="
                flex items-center gap-3 px-4 py-2 text-sm text-gray-700
                hover:bg-gray-100 transition-colors
              "
            >
              <Settings className="h-4 w-4 text-gray-400" />
              Settings
            </Link>

            <Link
              href="#"
              onClick={() => setIsOpen(false)}
              className="
                flex items-center gap-3 px-4 py-2 text-sm text-gray-700
                hover:bg-gray-100 transition-colors
              "
            >
              <HelpCircle className="h-4 w-4 text-gray-400" />
              Help & Support
            </Link>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="
              w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600
              hover:bg-red-50 transition-colors font-medium
            "
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
