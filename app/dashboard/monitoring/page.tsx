'use client';

/**
 * /dashboard/monitoring — environmental monitoring dashboard.
 *
 *   - per-room climate cards (latest temp/humidity, staleness, open alerts)
 *   - stale-sensor card (rooms silent for 30+ minutes)
 *   - alert lifecycle list (acknowledge / resolve — manager+)
 *   - per-room climate history chart
 *   - "Simulate" buttons (admin only) driving /api/sensors/simulate so the app
 *     need no hardware
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCheck,
  Play,
  Radio,
  Thermometer,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  acknowledgeAlert,
  getRoomReadings,
  listAlerts,
  listRoomStatuses,
  resolveAlert,
} from '@/lib/actions/sensors';
import { METRIC_LABELS } from '@/lib/storerooms/room-types';
import type {
  AlertDTO,
  RoomStatusDTO,
  SensorReadingDTO,
} from '@/lib/storerooms/types';
import { RoomTypeBadge, TempStatusDot } from '../rooms/_components/badges';
import ClimateChart from '../rooms/_components/ClimateChart';

const MANAGER_UP = ['super_admin', 'admin', 'manager'];
const STALE_MINUTES = 30;

function fmtAgo(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function MonitoringPage() {
  const { hasRole } = useAuth();
  const canAck = hasRole(MANAGER_UP);
  const canSimulate = hasRole(['super_admin', 'admin']);

  const [statuses, setStatuses] = useState<RoomStatusDTO[]>([]);
  const [alerts, setAlerts] = useState<AlertDTO[]>([]);
  const [alertTab, setAlertTab] = useState<'active' | 'acknowledged' | 'resolved'>(
    'active',
  );
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [chartRoom, setChartRoom] = useState<string>('');
  const [chartData, setChartData] = useState<SensorReadingDTO[]>([]);

  const load = useCallback(async () => {
    const [statusRes, alertRes] = await Promise.all([
      listRoomStatuses(),
      listAlerts({ state: alertTab }),
    ]);
    if (statusRes.success) {
      setStatuses(statusRes.data);
      if (!chartRoom && statusRes.data.length > 0) {
        setChartRoom(statusRes.data[0].room_id);
      }
    } else setError(statusRes.error);
    if (alertRes.success) setAlerts(alertRes.data);
    setLoading(false);
  }, [alertTab, chartRoom]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Load chart series when the selected room changes.
  useEffect(() => {
    if (!chartRoom) return;
    (async () => {
      const res = await getRoomReadings({ room_id: chartRoom, hours: 24 });
      if (res.success) setChartData(res.data);
    })();
  }, [chartRoom]);

  const runSimulate = async (excursion: boolean) => {
    setSimulating(true);
    setError(null);
    try {
      const url = `/api/sensors/simulate?points=1${excursion ? '&excursion=1' : ''}`;
      const res = await fetch(url, { method: 'POST' });
      const json = (await res.json()) as {
        error?: string;
        inserted?: number;
        alerts_opened?: number;
      };
      if (!res.ok) throw new Error(json.error ?? 'Simulation failed');
      setMessage(
        `Simulated ${json.inserted} readings` +
          (json.alerts_opened ? ` — ${json.alerts_opened} alert(s) opened` : ''),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setSimulating(false);
    }
  };

  const seedHistory = async () => {
    setSimulating(true);
    setError(null);
    try {
      const res = await fetch(
        '/api/sensors/simulate?points=48&step_minutes=30',
        { method: 'POST' },
      );
      const json = (await res.json()) as { error?: string; inserted?: number };
      if (!res.ok) throw new Error(json.error ?? 'Seed failed');
      setMessage(`Seeded ${json.inserted} readings of history`);
      await load();
      const r = await getRoomReadings({ room_id: chartRoom, hours: 24 });
      if (r.success) setChartData(r.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Seed failed');
    } finally {
      setSimulating(false);
    }
  };

  const handleAck = async (id: string) => {
    const res = await acknowledgeAlert(id);
    if (res.success) await load();
    else setError(res.error);
  };

  const handleResolve = async (id: string) => {
    const res = await resolveAlert(id);
    if (res.success) await load();
    else setError(res.error);
  };

  const stale = statuses.filter(
    (r) =>
      r.minutes_since_reading === null ||
      r.minutes_since_reading >= STALE_MINUTES,
  );
  const chartRoomInfo = statuses.find((r) => r.room_id === chartRoom) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Environmental Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Sensor health, climate telemetry and alert lifecycle
          </p>
        </div>
        {canSimulate && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => runSimulate(false)}
              disabled={simulating}
              className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors text-sm disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Simulate tick
            </button>
            <button
              onClick={() => runSimulate(true)}
              disabled={simulating}
              className="flex items-center gap-2 px-4 py-2 border border-destructive/40 text-destructive rounded-lg hover:bg-destructive/10 transition-colors text-sm disabled:opacity-50"
              title="Force a temperature excursion — opens threshold alerts"
            >
              <Zap className="h-4 w-4" />
              Force excursion
            </button>
            <button
              onClick={seedHistory}
              disabled={simulating}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
              title="Backfill 24h of readings for charts"
            >
              <Activity className="h-4 w-4" />
              Seed 24h history
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">{error}</div>
      )}
      {message && (
        <div className="p-4 rounded-lg bg-success/10 text-success">{message}</div>
      )}

      {/* Room status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {statuses.map((s) => (
          <Link
            key={s.room_id}
            href={`/dashboard/rooms/${s.room_id}`}
            className="bg-card rounded-lg border border-border shadow-sm p-5 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{s.room_name}</h3>
                <RoomTypeBadge type={s.type} />
              </div>
              {s.open_alert_count > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  {s.open_alert_count}
                </span>
              )}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <TempStatusDot status={s.temp_status} />
                  <span className="text-2xl font-bold text-foreground">
                    {s.latest_temp !== null
                      ? `${s.latest_temp.toFixed(1)}°C`
                      : '—'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {s.latest_humidity !== null &&
                    `${s.latest_humidity.toFixed(0)}% RH · `}
                  {(s.temp_min !== null || s.temp_max !== null) &&
                    `range ${s.temp_min ?? '−∞'}…${s.temp_max ?? '+∞'}°C`}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <Radio className="h-3.5 w-3.5 inline mr-1" />
                {fmtAgo(s.last_reading_at)}
              </div>
            </div>
          </Link>
        ))}
        {statuses.length === 0 && !loading && (
          <div className="col-span-full bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
            No active rooms — create one under{' '}
            <Link href="/dashboard/rooms" className="text-primary underline">
              Storerooms
            </Link>
            .
          </div>
        )}
      </div>

      {/* Stale sensors */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
          <Radio className="h-5 w-5 text-muted-foreground" />
          Stale sensors
          <span className="text-sm font-normal text-muted-foreground">
            (no reading in {STALE_MINUTES}+ min)
          </span>
        </h2>
        {stale.length === 0 ? (
          <p className="text-sm text-success">
            All monitored rooms reported recently.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stale.map((s) => (
              <Link
                key={s.room_id}
                href={`/dashboard/rooms/${s.room_id}`}
                className="px-3 py-1.5 bg-warning/10 border border-warning/30 text-warning rounded-lg text-sm hover:bg-warning/15"
              >
                {s.room_name} · {fmtAgo(s.last_reading_at)}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            Alerts
          </h2>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(['active', 'acknowledged', 'resolved'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setAlertTab(s)}
                className={`px-3 py-1 rounded-md text-sm capitalize ${
                  alertTab === s
                    ? 'bg-card shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No {alertTab} alerts.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-muted-foreground uppercase border-b border-border">
                <th className="pb-2">Room</th>
                <th className="pb-2">Metric</th>
                <th className="pb-2">Value</th>
                <th className="pb-2">Opened</th>
                <th className="pb-2">Status</th>
                {canAck && <th className="pb-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5 text-sm">
                    <Link
                      href={`/dashboard/rooms/${a.room_id}`}
                      className="text-primary hover:underline"
                    >
                      {a.room_name ?? a.room_id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="py-2.5 text-sm text-muted-foreground">
                    {METRIC_LABELS[a.metric]}
                  </td>
                  <td className="py-2.5 text-sm font-medium text-foreground">
                    {a.value}
                    {a.metric === 'temperature' ? '°C' : ''}
                  </td>
                  <td className="py-2.5 text-sm text-muted-foreground">
                    {fmtAgo(a.opened_at)}
                  </td>
                  <td className="py-2.5 text-sm">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.state === 'active'
                          ? 'bg-destructive/10 text-destructive'
                          : a.state === 'acknowledged'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-success/10 text-success'
                      }`}
                    >
                      {a.state}
                      {a.acked_by_name ? ` · ${a.acked_by_name}` : ''}
                    </span>
                  </td>
                  {canAck && (
                    <td className="py-2.5 text-sm text-right">
                      <div className="inline-flex gap-2">
                        {a.state === 'active' && (
                          <button
                            onClick={() => handleAck(a.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 border border-input rounded-lg hover:bg-muted text-xs"
                          >
                            <Check className="h-3.5 w-3.5" /> Acknowledge
                          </button>
                        )}
                        {a.state !== 'resolved' && (
                          <button
                            onClick={() => handleResolve(a.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-success text-success-foreground rounded-lg hover:bg-success/90 text-xs"
                          >
                            <CheckCheck className="h-3.5 w-3.5" /> Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Climate history */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-muted-foreground" />
            Climate history — 24h
          </h2>
          <select
            value={chartRoom}
            onChange={(e) => setChartRoom(e.target.value)}
            className="px-3 py-2 border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {statuses.map((s) => (
              <option key={s.room_id} value={s.room_id}>
                {s.room_name}
              </option>
            ))}
          </select>
        </div>
        <ClimateChart
          readings={chartData}
          tempMin={chartRoomInfo?.temp_min ?? null}
          tempMax={chartRoomInfo?.temp_max ?? null}
        />
      </div>
    </div>
  );
}
