/**
 * Sidebar Navigation Component
 * Left navigation panel with menu items
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { visibleNavItems } from '@/lib/navigation-config';
import { ChevronRight, Package } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  // effectiveRole already accounts for impersonation AND worker preview —
  // so the sidebar always renders the persona the user is acting as.
  const { profile, effectiveRole, previewAsOperator } = useAuth();

  const visibleItems = visibleNavItems(effectiveRole);

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden md:flex w-64 bg-sidebar text-sidebar-foreground flex-col h-screen sticky top-0 z-40">
      {/* Logo Section */}
      <div className="p-6 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">VMS</h1>
            <p className="text-xs text-sidebar-muted">Inventory</p>
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
                    ? 'bg-primary text-sidebar-foreground shadow-lg'
                    : 'text-sidebar-foreground hover:bg-sidebar hover:text-sidebar-foreground'
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
                      active ? 'text-sidebar-foreground/80' : 'text-sidebar-muted'
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </div>
              {active && (
                <ChevronRight className="h-4 w-4 text-sidebar-foreground/50 group-hover:translate-x-1 transition-transform" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Role Badge */}
      <div className="border-t border-sidebar-border p-4">
        <div className="bg-sidebar rounded-lg p-3">
          <p className="text-xs text-sidebar-muted mb-1">
            {previewAsOperator ? 'Previewing as' : 'Current Role'}
          </p>
          <p className="text-sm font-bold text-primary uppercase">
            {(previewAsOperator ? 'operator' : effectiveRole?.replace('_', ' ')) ||
              profile?.role?.replace('_', ' ')}
          </p>
        </div>
      </div>
    </aside>
  );
}
