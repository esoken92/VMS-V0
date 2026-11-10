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
        sticky top-0 z-30 bg-card border-b border-border
        ${isImpersonating ? 'border-warning/50' : 'border-border'}
      `}
    >
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-warning/10 border-b border-warning/30 px-4 py-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-warning" />
          <p className="text-sm font-medium text-warning">
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
            className="md:hidden p-2 hover:bg-muted rounded-lg"
          >
            <Menu className="h-6 w-6 text-muted-foreground" />
          </button>

          {/* Page Title */}
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              VMS Inventory Management
            </h1>
            <p className="text-xs text-muted-foreground">Heavy-Duty Truck Parts</p>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="
                relative p-2 text-muted-foreground hover:text-foreground
                hover:bg-muted rounded-lg transition-colors
              "
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-destructive/100 rounded-full" />
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-card rounded-lg shadow-lg border border-border z-50">
                <div className="p-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">Notifications</h3>
                </div>
                <div className="divide-y divide-border">
                  <div className="p-4 hover:bg-muted cursor-pointer">
                    <p className="text-sm font-medium text-foreground">
                      Low Stock Alert
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      5 products below minimum threshold
                    </p>
                  </div>
                  <div className="p-4 hover:bg-muted cursor-pointer">
                    <p className="text-sm font-medium text-foreground">
                      Overdue Tool Return
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      2 tools overdue for return
                    </p>
                  </div>
                </div>
                <div className="p-4 border-t border-border text-center">
                  <button className="text-xs font-medium text-primary hover:text-primary/80">
                    View All Notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-6 bg-input" />

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
