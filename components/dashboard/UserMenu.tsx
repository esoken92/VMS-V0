/**
 * User Menu Dropdown Component
 * Profile menu with settings and logout
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { canPreviewAsWorker } from '@/lib/persona';
import {
  LogOut,
  Settings,
  User,
  HelpCircle,
  ChevronDown,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function UserMenu() {
  const {
    profile,
    user,
    logout,
    isImpersonating,
    exitImpersonation,
    previewAsOperator,
    effectiveRole,
    enterWorkerPreview,
    exitWorkerPreview,
  } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleEnterWorkerPreview = async () => {
    setIsOpen(false);
    await enterWorkerPreview();
  };

  const handleExitWorkerPreview = async () => {
    setIsOpen(false);
    await exitWorkerPreview();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-3 px-4 py-2 rounded-lg
          hover:bg-gray-100 transition-colors
          focus:outline-none focus:ring-2 focus:ring-primary
        "
      >
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-bold text-sm">
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

      {isOpen && (
        <div
          className="
            absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg
            border border-gray-200 z-50 overflow-hidden
          "
        >
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-sm font-semibold text-gray-900">
              {profile?.full_name}
            </p>
            <p className="text-xs text-gray-500">{user?.email}</p>
            <div className="mt-2 flex gap-2">
              <span className="px-2 py-1 bg-blue-100 text-primary text-xs font-medium rounded">
                {profile?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>

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

          <div className="py-2">
            {previewAsOperator ? (
              <button
                onClick={handleExitWorkerPreview}
                className="
                  w-full flex items-center gap-3 px-4 py-2 text-sm text-primary
                  hover:bg-blue-50 transition-colors
                "
              >
                <EyeOff className="h-4 w-4 text-primary/70" />
                Exit Worker Preview
              </button>
            ) : (
              canPreviewAsWorker(profile?.role) && (
                <button
                  onClick={handleEnterWorkerPreview}
                  className="
                    w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700
                    hover:bg-gray-100 transition-colors
                  "
                >
                  <Eye className="h-4 w-4 text-gray-400" />
                  View as Worker
                </button>
              )
            )}

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

            {/* System settings is super_admin-only (lib/persona ROUTE_ACCESS) */}
            {effectiveRole === 'super_admin' && (
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
            )}

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

          <div className="border-t border-gray-100" />

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
