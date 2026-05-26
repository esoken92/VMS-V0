'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Package, BarChart3, User, QrCode } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Home', roles: ['super_admin', 'admin', 'fleet_dispatch', 'staff'] },
    { href: '/dashboard/inventory', icon: Package, label: 'Inventory', roles: ['super_admin', 'admin', 'fleet_dispatch', 'staff'] },
    { href: '/scan', icon: QrCode, label: 'Scan', roles: ['super_admin', 'admin', 'fleet_dispatch', 'staff'] },
    { href: '/dashboard/reports', icon: BarChart3, label: 'Reports', roles: ['super_admin', 'admin'] },
    { href: '/dashboard/profile', icon: User, label: 'Profile', roles: ['super_admin', 'admin', 'fleet_dispatch', 'staff'] },
  ];

  const filteredItems = navItems.filter((item) =>
    item.roles.includes(profile?.role || 'staff')
  );

  // Don't show on auth pages or scan page (scan has its own UI)
  if (pathname.startsWith('/auth') || pathname === '/scan') {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50">
      <nav className="flex items-center justify-around py-2">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
