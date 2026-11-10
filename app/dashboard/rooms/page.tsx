'use client';

/**
 * /dashboard/rooms — storeroom list.
 * Type badges, occupancy (stock units vs capacity), latest temperature
 * status, children counts, open-alert indicator. Manager+ sees Add/Edit.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Warehouse, AlertTriangle, Thermometer } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { listRooms } from '@/lib/actions/storerooms';
import type { RoomListItemDTO } from '@/lib/storerooms/types';
import {
  AccessLevelBadge,
  RoomTypeBadge,
  TempStatusDot,
} from './_components/badges';

const MANAGER_UP = ['super_admin', 'admin', 'manager'];

export default function RoomsPage() {
  const { hasRole } = useAuth();
  const [rooms, setRooms] = useState<RoomListItemDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasRole(MANAGER_UP);

  useEffect(() => {
    (async () => {
      const res = await listRooms();
      if (res.success) setRooms(res.data);
      else setError(res.error);
      setLoading(false);
    })();
  }, []);

  const filtered = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.type.includes(search.toLowerCase()) ||
      (r.parent_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const occupancyPct = (r: RoomListItemDTO) =>
    r.capacity_units && r.capacity_units > 0
      ? Math.min(100, Math.round((r.stock_units / r.capacity_units) * 100))
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Storerooms</h1>
          <p className="text-gray-600 mt-1">
            Room hierarchy, access control and environmental config
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/monitoring"
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          >
            <Thermometer className="h-4 w-4" />
            Monitoring
          </Link>
          {canEdit && (
            <Link
              href="/dashboard/rooms/new"
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Room
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-800">{error}</div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms…"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading rooms…</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Room
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Access
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Occupancy
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Temp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Alerts
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((r) => {
                const pct = occupancyPct(r);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/rooms/${r.id}`}
                        className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                      >
                        <Warehouse className="h-4 w-4 text-gray-400" />
                        {r.name}
                        {!r.active && (
                          <span className="text-xs text-gray-400">(inactive)</span>
                        )}
                        {r.quarantine && (
                          <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs">
                            quarantine
                          </span>
                        )}
                      </Link>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.parent_name ? `in ${r.parent_name} · ` : ''}
                        {r.child_count > 0 ? `${r.child_count} sub-room${r.child_count > 1 ? 's' : ''}` : 'top level'}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoomTypeBadge type={r.type} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AccessLevelBadge level={r.access_level} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pct === null ? (
                        <span className="text-sm text-gray-500">
                          {r.product_count} item{r.product_count === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <div className="w-32">
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{pct}%</span>
                            <span>
                              {r.stock_units}/{r.capacity_units}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                pct >= 90
                                  ? 'bg-red-500'
                                  : pct >= 70
                                    ? 'bg-amber-500'
                                    : 'bg-green-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm">
                        <TempStatusDot status={r.temp_status} />
                        {r.latest_temp !== null ? (
                          <span
                            className={
                              r.temp_status === 'ok'
                                ? 'text-gray-900'
                                : 'text-red-600 font-medium'
                            }
                          >
                            {r.latest_temp.toFixed(1)}°C
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                      {(r.temp_min !== null || r.temp_max !== null) && (
                        <p className="text-xs text-gray-400">
                          {r.temp_min ?? '−∞'}…{r.temp_max ?? '+∞'}°C
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {r.open_alert_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-sm text-red-600 font-medium">
                          <AlertTriangle className="h-4 w-4" />
                          {r.open_alert_count}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No rooms found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
