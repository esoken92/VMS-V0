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
          hover:bg-muted transition-colors
          focus:outline-none focus:ring-2 focus:ring-primary
        "
      >
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm">
          {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-foreground">
            {profile?.full_name}
          </p>
          <p className="text-xs text-muted-foreground">{profile?.role?.replace('_', ' ')}</p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className="
            absolute right-0 mt-2 w-56 bg-card rounded-lg shadow-lg
            border border-border z-50 overflow-hidden
          "
        >
          <div className="px-4 py-3 border-b border-border bg-muted">
            <p className="text-sm font-semibold text-foreground">
              {profile?.full_name}
            </p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <div className="mt-2 flex gap-2">
              <span className="px-2 py-1 bg-info/10 text-primary text-xs font-medium rounded">
                {profile?.role?.replace('_', ' ')}
              </span>
            </div>
          </div>

          {isImpersonating && (
            <div className="px-4 py-3 border-b border-warning/30 bg-warning/10">
              <p className="text-xs font-medium text-warning mb-2">
                🎭 Super Admin Mode Active
              </p>
              <button
                onClick={handleImpersonationExit}
                className="
                  w-full px-3 py-1 text-xs font-medium
                  bg-warning text-warning-foreground rounded
                  hover:bg-warning/90 transition-colors
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
                  hover:bg-muted transition-colors
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
                    w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground
                    hover:bg-muted transition-colors
                  "
                >
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  View as Worker
                </button>
              )
            )}

            <Link
              href="/dashboard/profile"
              onClick={() => setIsOpen(false)}
              className="
                flex items-center gap-3 px-4 py-2 text-sm text-foreground
                hover:bg-muted transition-colors
              "
            >
              <User className="h-4 w-4 text-muted-foreground" />
              My Profile
            </Link>

            {/* System settings is super_admin-only (lib/persona ROUTE_ACCESS) */}
            {effectiveRole === 'super_admin' && (
              <Link
                href="/dashboard/settings"
                onClick={() => setIsOpen(false)}
                className="
                  flex items-center gap-3 px-4 py-2 text-sm text-foreground
                  hover:bg-muted transition-colors
                "
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                Settings
              </Link>
            )}

            <Link
              href="#"
              onClick={() => setIsOpen(false)}
              className="
                flex items-center gap-3 px-4 py-2 text-sm text-foreground
                hover:bg-muted transition-colors
              "
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Help & Support
            </Link>
          </div>

          <div className="border-t border-border" />

          <button
            onClick={handleLogout}
            className="
              w-full flex items-center gap-3 px-4 py-2 text-sm text-destructive
              hover:bg-destructive/10 transition-colors font-medium
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
