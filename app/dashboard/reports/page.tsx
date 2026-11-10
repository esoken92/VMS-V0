'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Package, AlertTriangle, Download, BarChart3, FileText } from 'lucide-react';
import { getReportData } from '@/lib/actions/reports';
import type { ReportMovementDTO, ReportProductDTO } from '@/lib/types';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [showExtraReportsModal, setShowExtraReportsModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [kpiData, setKpiData] = useState({
    totalMovements: 0,
    stockValue: 0,
    lowStockItems: 0,
    scrapRate: 0,
  });
  const [movements, setMovements] = useState<ReportMovementDTO[]>([]);
  const [products, setProducts] = useState<ReportProductDTO[]>([]);
  // "Now" is captured when data lands so render stays pure (react-hooks/purity)
  // and day buckets stay consistent across re-renders.
  const [asOf, setAsOf] = useState(0);

  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      const days = parseInt(dateRange);
      const result = await getReportData(days);
      if (!result.success) throw new Error(result.error);

      const movementsData = result.data.movements;
      const productsData = result.data.products;

      setMovements(movementsData);
      setProducts(productsData);
      setAsOf(Date.now());

      // Calculate KPIs
      const totalMovements = movementsData.length;
      const stockValue = productsData.reduce((sum, p) => sum + p.current_stock * p.average_cost, 0);
      const lowStockItems = productsData.filter((p) => p.current_stock <= p.min_threshold).length;
      const scrapMovements = movementsData.filter((m) => m.type === 'scrap').length;
      const scrapRate = totalMovements > 0 ? (scrapMovements / totalMovements) * 100 : 0;

      setKpiData({
        totalMovements,
        stockValue,
        lowStockItems,
        scrapRate,
      });
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleExport = () => {
    // Simple CSV export
    const headers = ['SKU', 'Name', 'Stock', 'Min Threshold', 'Unit', 'Average Cost'];
    const rows = products.map(p => [
      p.sku,
      p.name,
      p.current_stock,
      p.min_threshold,
      p.unit_of_measure,
      p.average_cost,
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getTopProducts = () => {
    const productMovements = products.map(p => ({
      ...p,
      movementCount: movements.filter(m => m.product_id === p.id).length,
    }));
    return productMovements
      .sort((a, b) => b.movementCount - a.movementCount)
      .slice(0, 5);
  };

  const topProducts = getTopProducts();
  const maxMovementCount = topProducts.length > 0 ? topProducts[0].movementCount : 1;

  // Group movements per day × type for the trend chart.
  const trendData = useMemo(() => {
    if (asOf === 0) return [];
    const days = parseInt(dateRange === '1y' ? '365' : dateRange);
    const byDay = new Map<string, { day: string; inbound: number; outbound: number; scrap: number; adjustment: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(asOf - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, { day: key.slice(5), inbound: 0, outbound: 0, scrap: 0, adjustment: 0 });
    }
    for (const m of movements) {
      if (!m.created_at) continue;
      const key = m.created_at.slice(0, 10);
      const row = byDay.get(key);
      if (!row) continue;
      const t = m.type as 'inbound' | 'outbound' | 'scrap' | 'adjustment';
      if (t in row) row[t] += Math.abs(m.quantity);
    }
    const data = [...byDay.values()];
    // For year views thin out the x-axis noise — monthly buckets.
    if (days > 90) {
      const byMonth = new Map<string, (typeof data)[number]>();
      for (const r of data) {
        const key = r.day.slice(0, 2); // MM from MM-DD
        const m = byMonth.get(key) ?? { day: key, inbound: 0, outbound: 0, scrap: 0, adjustment: 0 };
        m.inbound += r.inbound; m.outbound += r.outbound; m.scrap += r.scrap; m.adjustment += r.adjustment;
        byMonth.set(key, m);
      }
      return [...byMonth.values()];
    }
    return data;
  }, [movements, dateRange, asOf]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <a
            href="/dashboard/reports/builder"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            Report Builder
          </a>
          <button
            onClick={() => setShowExtraReportsModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
          >
            <FileText className="h-4 w-4" />
            Extra Reports
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => window.open('/api/reports/inventory-valuation', '_blank', 'noopener')}
            className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
          >
            <FileText className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Movements</p>
              <p className="text-2xl font-bold text-foreground mt-1">{kpiData.totalMovements}</p>
            </div>
            <div className="p-3 bg-info/10 rounded-lg">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Stock movements in period</p>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Stock Value</p>
              <p className="text-2xl font-bold text-foreground mt-1">${kpiData.stockValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-success/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Total inventory value</p>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Low Stock Items</p>
              <p className="text-2xl font-bold text-foreground mt-1">{kpiData.lowStockItems}</p>
            </div>
            <div className="p-3 bg-warning/15 rounded-lg">
              <Package className="h-6 w-6 text-warning" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Items below threshold</p>
        </div>

        <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Scrap Rate</p>
              <p className="text-2xl font-bold text-foreground mt-1">{kpiData.scrapRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Scrap vs total movements</p>
        </div>
      </div>

      {/* Report Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Stock Movement Trends</h2>
          <div className="h-64">
            {loading ? (
              <div className="h-full bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Loading…</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="inbound" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.2)" name="Inbound" />
                  <Area type="monotone" dataKey="outbound" stackId="1" stroke="hsl(var(--info))" fill="hsl(var(--info) / 0.2)" name="Outbound" />
                  <Area type="monotone" dataKey="adjustment" stackId="1" stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.2)" name="Adjustment" />
                  <Area type="monotone" dataKey="scrap" stackId="1" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive) / 0.2)" name="Scrap" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Top Products by Movement</h2>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-4">
              {topProducts.map((product, index) => {
                const percentage = maxMovementCount > 0 ? (product.movementCount / maxMovementCount) * 100 : 0;
                const colors = ['blue', 'green', 'purple', 'orange', 'pink'];
                const color = colors[index % colors.length];
                return (
                  <div key={product.id} className="flex items-center gap-4">
                    <div className={`w-8 h-8 bg-${color}-100 rounded-lg flex items-center justify-center text-${color}-600 font-bold text-sm`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{product.name}</p>
                      <div className="w-full bg-input rounded-full h-2 mt-1">
                        <div className={`bg-${color}-600 h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-foreground">{product.movementCount}</p>
                  </div>
                );
              })}
              {topProducts.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No movement data available</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inventory Report */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Inventory Summary</h2>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-input rounded-lg hover:bg-muted transition-colors"
          >
            <FileText className="h-4 w-4" />
            Export
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Min Threshold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {products.slice(0, 10).map((product) => {
                const isLowStock = product.current_stock <= product.min_threshold;
                const value = product.current_stock * product.average_cost;
                return (
                  <tr key={product.id} className="hover:bg-muted">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{product.current_stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.min_threshold}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">${value.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${isLowStock ? 'bg-warning/15 text-warning' : 'bg-success/10 text-success'}`}>
                        {isLowStock ? 'Low Stock' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Extra Reports Modal */}
      {showExtraReportsModal && (
        <div className="fixed inset-0 bg-sidebar/70 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Extra Reports</h2>
              <button
                onClick={() => setShowExtraReportsModal(false)}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {!selectedReport ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedReport('total_movements')}
                    className="p-6 border border-border rounded-lg hover:bg-muted hover:border-primary/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-info/10 rounded-lg">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">Total Movements</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Detailed breakdown of all stock movements by type and date</p>
                  </button>
                  <button
                    onClick={() => setSelectedReport('stock_value')}
                    className="p-6 border border-border rounded-lg hover:bg-muted hover:border-success/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-success/10 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-success" />
                      </div>
                      <h3 className="font-semibold text-foreground">Stock Value</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Total inventory value by product category and location</p>
                  </button>
                  <button
                    onClick={() => setSelectedReport('low_stock')}
                    className="p-6 border border-border rounded-lg hover:bg-warning/10 hover:border-warning/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-warning/15 rounded-lg">
                        <Package className="h-5 w-5 text-warning" />
                      </div>
                      <h3 className="font-semibold text-foreground">Low Stock Items</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">List of all products below minimum threshold</p>
                  </button>
                  <button
                    onClick={() => setSelectedReport('scrap_rate')}
                    className="p-6 border border-border rounded-lg hover:bg-destructive/10 hover:border-destructive/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-destructive/10 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      </div>
                      <h3 className="font-semibold text-foreground">Scrap Rate</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Scrap movement analysis and rate calculation</p>
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="mb-4 text-sm text-primary hover:text-primary/80"
                  >
                    ← Back to reports
                  </button>
                  {selectedReport === 'total_movements' && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Total Movements Report</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {['inbound', 'outbound', 'scrap', 'adjustment'].map(type => {
                            const count = movements.filter(m => m.type === type).length;
                            return (
                              <div key={type} className="bg-muted rounded-lg p-4">
                                <p className="text-sm text-muted-foreground capitalize">{type}</p>
                                <p className="text-2xl font-bold text-foreground">{count}</p>
                              </div>
                            );
                          })}
                        </div>
                        <table className="w-full mt-4">
                          <thead className="bg-muted border-b border-border">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Count</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Percentage</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {['inbound', 'outbound', 'scrap', 'adjustment'].map(type => {
                              const count = movements.filter(m => m.type === type).length;
                              const percentage = movements.length > 0 ? ((count / movements.length) * 100).toFixed(1) : 0;
                              return (
                                <tr key={type}>
                                  <td className="px-4 py-2 text-sm capitalize">{type}</td>
                                  <td className="px-4 py-2 text-sm">{count}</td>
                                  <td className="px-4 py-2 text-sm">{percentage}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {selectedReport === 'stock_value' && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Stock Value Report</h3>
                      <div className="space-y-4">
                        <div className="bg-success/10 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground">Total Inventory Value</p>
                          <p className="text-3xl font-bold text-foreground">${kpiData.stockValue.toLocaleString()}</p>
                        </div>
                        <table className="w-full">
                          <thead className="bg-muted border-b border-border">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Product</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Stock</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Unit Cost</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Total Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {products.slice(0, 20).map(product => {
                              const value = product.current_stock * product.average_cost;
                              return (
                                <tr key={product.id}>
                                  <td className="px-4 py-2 text-sm">{product.name}</td>
                                  <td className="px-4 py-2 text-sm">{product.current_stock}</td>
                                  <td className="px-4 py-2 text-sm">${product.average_cost.toFixed(2)}</td>
                                  <td className="px-4 py-2 text-sm font-medium">${value.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {selectedReport === 'low_stock' && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Low Stock Items Report</h3>
                      <div className="space-y-4">
                        <div className="bg-warning/10 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground">Total Low Stock Items</p>
                          <p className="text-3xl font-bold text-foreground">{kpiData.lowStockItems}</p>
                        </div>
                        <table className="w-full">
                          <thead className="bg-muted border-b border-border">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">SKU</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Current Stock</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Min Threshold</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Shortage</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {products.filter(p => p.current_stock <= p.min_threshold).map(product => {
                              const shortage = product.min_threshold - product.current_stock;
                              return (
                                <tr key={product.id} className="bg-warning/10">
                                  <td className="px-4 py-2 text-sm">{product.sku}</td>
                                  <td className="px-4 py-2 text-sm">{product.name}</td>
                                  <td className="px-4 py-2 text-sm font-medium text-destructive">{product.current_stock}</td>
                                  <td className="px-4 py-2 text-sm">{product.min_threshold}</td>
                                  <td className="px-4 py-2 text-sm font-medium text-destructive">{shortage.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                            {products.filter(p => p.current_stock <= p.min_threshold).length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No low stock items</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {selectedReport === 'scrap_rate' && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Scrap Rate Report</h3>
                      <div className="space-y-4">
                        <div className="bg-destructive/10 rounded-lg p-4">
                          <p className="text-sm text-muted-foreground">Overall Scrap Rate</p>
                          <p className="text-3xl font-bold text-foreground">{kpiData.scrapRate.toFixed(1)}%</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-muted rounded-lg p-4">
                            <p className="text-sm text-muted-foreground">Total Movements</p>
                            <p className="text-2xl font-bold text-foreground">{kpiData.totalMovements}</p>
                          </div>
                          <div className="bg-muted rounded-lg p-4">
                            <p className="text-sm text-muted-foreground">Scrap Movements</p>
                            <p className="text-2xl font-bold text-foreground">{movements.filter(m => m.type === 'scrap').length}</p>
                          </div>
                        </div>
                        <table className="w-full">
                          <thead className="bg-muted border-b border-border">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Product</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Scrap Count</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Total Quantity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {products.map(product => {
                              const scrapMovements = movements.filter(m => m.product_id === product.id && m.type === 'scrap');
                              if (scrapMovements.length === 0) return null;
                              const totalQuantity = scrapMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
                              return (
                                <tr key={product.id}>
                                  <td className="px-4 py-2 text-sm">{product.name}</td>
                                  <td className="px-4 py-2 text-sm">{scrapMovements.length}</td>
                                  <td className="px-4 py-2 text-sm">{totalQuantity.toFixed(2)}</td>
                                </tr>
                              );
                            }).filter(Boolean)}
                            {movements.filter(m => m.type === 'scrap').length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No scrap movements recorded</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
