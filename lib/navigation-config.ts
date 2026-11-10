/**
 * Navigation Configuration
 * Define all dashboard navigation items
 */

export interface NavigationItem {
  label: string;
  href: string;
  icon: string;
  description?: string;
}

export const navigationConfig: NavigationItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: '📊',
    description: 'Overview and quick stats',
  },
  {
    label: 'Inventory',
    href: '/dashboard/inventory',
    icon: '📦',
    description: 'Product management',
  },
  {
    label: 'Stock Movements',
    href: '/dashboard/stock-movements',
    icon: '🔄',
    description: 'Inbound, outbound, scrap',
  },
  {
    label: 'Stock Takes',
    href: '/dashboard/stock-takes',
    icon: '📋',
    description: 'Inventory counts',
  },
  {
    label: 'Tool Loans',
    href: '/dashboard/tool-loans',
    icon: '🔧',
    description: 'Tool checkout/return',
  },
  {
    label: 'Bin Locations',
    href: '/dashboard/bin-locations',
    icon: '📍',
    description: 'Warehouse locations',
  },
  {
    label: 'Zone Map',
    href: '/dashboard/zone-map',
    icon: '🗺️',
    description: 'Visual warehouse layout',
  },
  {
    label: 'Scan',
    href: '/dashboard/scan',
    icon: '📷',
    description: 'Scan-first receive, issue & lookup',
  },
  {
    label: 'Storerooms',
    href: '/dashboard/rooms',
    icon: '🏠',
    description: 'Rooms, zones & access rules',
  },
  {
    label: 'Monitoring',
    href: '/dashboard/monitoring',
    icon: '🌡️',
    description: 'Sensors, climate & alerts',
  },
  {
    label: 'Integrations',
    href: '/dashboard/integrations',
    icon: '🔌',
    description: 'MCP, API keys & docs',
  },
];

export const adminOnlyNavigation: NavigationItem[] = [
  {
    label: 'Reports',
    href: '/dashboard/reports',
    icon: '📈',
    description: 'Analytics and insights',
  },
  {
    label: 'Users',
    href: '/dashboard/users',
    icon: '👥',
    description: 'User management',
  },
  {
    label: 'Suppliers',
    href: '/dashboard/suppliers',
    icon: '🚚',
    description: 'Supplier management',
  },
  {
    label: 'Audit Log',
    href: '/dashboard/audit-log',
    icon: '📝',
    description: 'Activity history',
  },
];

export const superAdminNavigation: NavigationItem[] = [
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: '⚙️',
    description: 'System configuration',
  },
  {
    label: 'Impersonate',
    href: '/dashboard/impersonate',
    icon: '🎭',
    description: 'View as user',
  },
];

export const userMenuItems: NavigationItem[] = [
  {
    label: 'My Profile',
    href: '/dashboard/profile',
    icon: '👤',
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: '⚙️',
  },
  {
    label: 'Help',
    href: '#',
    icon: '❓',
  },
];
