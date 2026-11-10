'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { getDashboardStats, type DashboardStats } from '@/lib/actions/dashboard';
import { Package, TrendingUp, AlertTriangle, CheckCircle, PackagePlus, Wrench, ClipboardList } from 'lucide-react';
import Link from 'next/link';

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [todayLabel, setTodayLabel] = useState('');

  useEffect(() => {
    getDashboardStats()
      .then((r) => {
        if (r.success) setStats(r.data);
      })
      .catch(() => undefined);
    setTodayLabel(
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    );
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventory overview</h1>
        <p className="text-muted-foreground mt-1">
          {profile?.full_name ? `${profile.full_name} · ` : ''}
          {profile?.role ?? 'staff'} · {todayLabel}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/dashboard/inventory" className="bg-card p-6 rounded-lg border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Products</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stats ? stats.total_products.toLocaleString() : '—'}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">in catalog</p>
        </Link>

        <Link href="/dashboard/stock-movements" className="bg-card p-6 rounded-lg border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stock Movements</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stats ? stats.movements_this_month.toLocaleString() : '—'}
              </p>
            </div>
            <div className="p-3 bg-primary/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">this month</p>
        </Link>

        <Link href="/dashboard/inventory" className="bg-card p-6 rounded-lg border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Low Stock Alerts</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stats ? stats.low_stock_count : '—'}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${stats && stats.low_stock_count > 0 ? 'bg-warning/15' : 'bg-primary/10'}`}>
              <AlertTriangle className={`h-6 w-6 ${stats && stats.low_stock_count > 0 ? 'text-warning' : 'text-primary'}`} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">at or below threshold</p>
        </Link>

        <Link href="/dashboard/tool-loans" className="bg-card p-6 rounded-lg border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Tool Loans</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {stats ? stats.active_tool_loans : '—'}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${stats && stats.overdue_tool_loans > 0 ? 'bg-warning/15' : 'bg-primary/10'}`}>
              <CheckCircle className={`h-6 w-6 ${stats && stats.overdue_tool_loans > 0 ? 'text-warning' : 'text-primary'}`} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats ? `${stats.overdue_tool_loans} overdue` : ' '}
          </p>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/stock-movements" className="p-4 border border-border rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-colors text-left">
            <PackagePlus className="h-5 w-5 text-primary mb-2" />
            <p className="font-medium text-foreground">Record Stock Movement</p>
            <p className="text-sm text-muted-foreground">Add inbound or outbound stock</p>
          </Link>
          <Link href="/dashboard/tool-loans" className="p-4 border border-border rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-colors text-left">
            <Wrench className="h-5 w-5 text-primary mb-2" />
            <p className="font-medium text-foreground">Tool Check-Out</p>
            <p className="text-sm text-muted-foreground">Assign tool to staff member</p>
          </Link>
          <Link href="/dashboard/stock-takes" className="p-4 border border-border rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-colors text-left">
            <ClipboardList className="h-5 w-5 text-primary mb-2" />
            <p className="font-medium text-foreground">Start Stock Take</p>
            <p className="text-sm text-muted-foreground">Begin blind inventory count</p>
          </Link>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {stats === null && (
            <p className="text-sm text-muted-foreground">Loading recent activity…</p>
          )}
          {stats?.recent_movements.length === 0 && (
            <p className="text-sm text-muted-foreground">No stock movements yet.</p>
          )}
          {stats?.recent_movements.map((m) => (
            <div key={m.id} className="flex items-center gap-4 p-3 bg-muted rounded-lg">
              <div
                className={`w-2 h-2 rounded-full ${
                  m.quantity > 0 ? 'bg-success/100' : 'bg-primary'
                }`}
              ></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {m.type.charAt(0).toUpperCase() + m.type.slice(1)}:{' '}
                  {m.product_name ?? m.product_sku ?? 'Unknown product'}{' '}
                  ({m.quantity > 0 ? '+' : ''}
                  {m.quantity} {m.product_unit ?? ''})
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(m.created_at)} by {m.user_name ?? 'Unknown'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
