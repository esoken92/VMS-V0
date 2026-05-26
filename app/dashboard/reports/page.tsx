'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Package, AlertTriangle, Download, BarChart3, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ReportsPage() {
  // @ts-ignore - Supabase type issue
  const supabase = createClient();
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
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const days = parseInt(dateRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Fetch movements
      const { data: movementsData } = await supabase
        .from('stock_movements')
        .select('*')
        .gte('created_at', startDate.toISOString());
      
      // Fetch products
      const { data: productsData } = await supabase
        .from('products')
        .select('*');
      
      setMovements(movementsData || []);
      setProducts(productsData || []);
      
      // Calculate KPIs
      const totalMovements = movementsData?.length || 0;
      const stockValue = (productsData as any)?.reduce((sum: number, p: any) => sum + (p.current_stock * p.average_cost), 0) || 0;
      const lowStockItems = (productsData as any)?.filter((p: any) => p.current_stock <= p.min_threshold).length || 0;
      const scrapMovements = (movementsData as any)?.filter((m: any) => m.type === 'scrap').length || 0;
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
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Analytics and insights</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>
          <button
            onClick={() => setShowExtraReportsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Extra Reports
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Movements</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpiData.totalMovements}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Stock movements in period</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Stock Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">${kpiData.stockValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Total inventory value</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Low Stock Items</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpiData.lowStockItems}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Package className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Items below threshold</p>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scrap Rate</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{kpiData.scrapRate.toFixed(1)}%</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Scrap vs total movements</p>
        </div>
      </div>

      {/* Report Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stock Movement Trends</h2>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <p className="text-gray-500">Chart placeholder - Stock movement over time</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Products by Movement</h2>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
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
                      <p className="text-sm font-medium text-gray-900">{product.name}</p>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div className={`bg-${color}-600 h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-900">{product.movementCount}</p>
                  </div>
                );
              })}
              {topProducts.length === 0 && (
                <p className="text-gray-500 text-center py-4">No movement data available</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Inventory Report */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Inventory Summary</h2>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-4 w-4" />
            Export
          </button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Min Threshold</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.slice(0, 10).map((product) => {
                const isLowStock = product.current_stock <= product.min_threshold;
                const value = product.current_stock * product.average_cost;
                return (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{product.current_stock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.min_threshold}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${value.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${isLowStock ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                        {isLowStock ? 'Low Stock' : 'OK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Extra Reports Modal */}
      {showExtraReportsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Extra Reports</h2>
              <button
                onClick={() => setShowExtraReportsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              {!selectedReport ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setSelectedReport('total_movements')}
                    className="p-6 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Total Movements</h3>
                    </div>
                    <p className="text-sm text-gray-600">Detailed breakdown of all stock movements by type and date</p>
                  </button>
                  <button
                    onClick={() => setSelectedReport('stock_value')}
                    className="p-6 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Stock Value</h3>
                    </div>
                    <p className="text-sm text-gray-600">Total inventory value by product category and location</p>
                  </button>
                  <button
                    onClick={() => setSelectedReport('low_stock')}
                    className="p-6 border border-gray-200 rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Package className="h-5 w-5 text-yellow-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Low Stock Items</h3>
                    </div>
                    <p className="text-sm text-gray-600">List of all products below minimum threshold</p>
                  </button>
                  <button
                    onClick={() => setSelectedReport('scrap_rate')}
                    className="p-6 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                      </div>
                      <h3 className="font-semibold text-gray-900">Scrap Rate</h3>
                    </div>
                    <p className="text-sm text-gray-600">Scrap movement analysis and rate calculation</p>
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="mb-4 text-sm text-blue-600 hover:text-blue-700"
                  >
                    ← Back to reports
                  </button>
                  {selectedReport === 'total_movements' && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Total Movements Report</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {['inbound', 'outbound', 'scrap', 'adjustment'].map(type => {
                            const count = movements.filter(m => m.type === type).length;
                            return (
                              <div key={type} className="bg-gray-50 rounded-lg p-4">
                                <p className="text-sm text-gray-600 capitalize">{type}</p>
                                <p className="text-2xl font-bold text-gray-900">{count}</p>
                              </div>
                            );
                          })}
                        </div>
                        <table className="w-full mt-4">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Percentage</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
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
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Value Report</h3>
                      <div className="space-y-4">
                        <div className="bg-green-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Total Inventory Value</p>
                          <p className="text-3xl font-bold text-gray-900">${kpiData.stockValue.toLocaleString()}</p>
                        </div>
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
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
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Items Report</h3>
                      <div className="space-y-4">
                        <div className="bg-yellow-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Total Low Stock Items</p>
                          <p className="text-3xl font-bold text-gray-900">{kpiData.lowStockItems}</p>
                        </div>
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Min Threshold</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Shortage</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {products.filter(p => p.current_stock <= p.min_threshold).map(product => {
                              const shortage = product.min_threshold - product.current_stock;
                              return (
                                <tr key={product.id} className="bg-yellow-50">
                                  <td className="px-4 py-2 text-sm">{product.sku}</td>
                                  <td className="px-4 py-2 text-sm">{product.name}</td>
                                  <td className="px-4 py-2 text-sm font-medium text-red-600">{product.current_stock}</td>
                                  <td className="px-4 py-2 text-sm">{product.min_threshold}</td>
                                  <td className="px-4 py-2 text-sm font-medium text-red-600">{shortage.toFixed(2)}</td>
                                </tr>
                              );
                            })}
                            {products.filter(p => p.current_stock <= p.min_threshold).length === 0 && (
                              <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No low stock items</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {selectedReport === 'scrap_rate' && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Scrap Rate Report</h3>
                      <div className="space-y-4">
                        <div className="bg-red-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Overall Scrap Rate</p>
                          <p className="text-3xl font-bold text-gray-900">{kpiData.scrapRate.toFixed(1)}%</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600">Total Movements</p>
                            <p className="text-2xl font-bold text-gray-900">{kpiData.totalMovements}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm text-gray-600">Scrap Movements</p>
                            <p className="text-2xl font-bold text-gray-900">{movements.filter(m => m.type === 'scrap').length}</p>
                          </div>
                        </div>
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Scrap Count</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Quantity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
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
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">No scrap movements recorded</td>
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
