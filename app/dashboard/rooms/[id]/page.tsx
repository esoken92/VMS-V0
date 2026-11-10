'use client';

/**
 * /dashboard/rooms/[id] — room detail.
 *
 * Sections: climate chart (Recharts), contents (products resolved through
 * bin_locations.room_id), sub-rooms, feature-toggle editor, access/allowlist
 * editors, and alert rules. Manager+ can edit; staff gets a read view.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Edit,
  Package,
  Plus,
  Thermometer,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { USER_ROLES, ITEM_TYPES } from '@/lib/auth/roles';
import {
  getRoom,
  getRoomContents,
  updateRoomAccess,
  updateRoomToggles,
} from '@/lib/actions/storerooms';
import {
  getRoomReadings,
  listAlertRules,
  upsertAlertRule,
  deleteAlertRule,
} from '@/lib/actions/sensors';
import {
  ALERT_SEVERITIES,
  ALERT_THRESHOLD_OPS,
  ROOM_ACCESS_LEVELS,
  ROOM_FEATURES,
  SENSOR_METRICS,
  METRIC_LABELS,
} from '@/lib/storerooms/room-types';
import type {
  AlertRuleDTO,
  FeatureToggles,
  RoomContentItemDTO,
  RoomDTO,
  RoomOptionDTO,
  SensorReadingDTO,
} from '@/lib/storerooms/types';
import {
  AccessLevelBadge,
  RoomTypeBadge,
} from '../_components/badges';
import ClimateChart from '../_components/ClimateChart';
import ToggleSwitch from '../_components/ToggleSwitch';

const MANAGER_UP = ['super_admin', 'admin', 'manager'];
const inputCls =
  'w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm';

export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const canEdit = hasRole(MANAGER_UP);

  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [children, setChildren] = useState<RoomOptionDTO[]>([]);
  const [contents, setContents] = useState<RoomContentItemDTO[]>([]);
  const [readings, setReadings] = useState<SensorReadingDTO[]>([]);
  const [rules, setRules] = useState<AlertRuleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [editingAccess, setEditingAccess] = useState(false);
  const [accessLevel, setAccessLevel] = useState<RoomDTO['access_level']>('open');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [allowlist, setAllowlist] = useState<string[]>([]);
  const [extraItems, setExtraItems] = useState('');

  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    metric: 'temperature',
    op: 'above',
    threshold: '',
    dwell_minutes: '0',
    severity: 'warning',
    notify_roles: [] as string[],
  });

  const load = useCallback(async () => {
    const [roomRes, contentsRes, readingsRes, rulesRes] = await Promise.all([
      getRoom(params.id),
      getRoomContents(params.id),
      getRoomReadings({ room_id: params.id, hours: 24 }),
      listAlertRules(params.id),
    ]);
    if (roomRes.success) {
      setRoom(roomRes.data.room);
      setChildren(roomRes.data.children);
      setAccessLevel(roomRes.data.room.access_level);
      setAllowedRoles(roomRes.data.room.allowed_roles);
      setAllowlist(roomRes.data.room.item_allowlist);
      setExtraItems(
        roomRes.data.room.item_allowlist
          .filter((i) => !(ITEM_TYPES as readonly string[]).includes(i))
          .join(', '),
      );
    } else setError(roomRes.error);
    if (contentsRes.success) setContents(contentsRes.data);
    if (readingsRes.success) setReadings(readingsRes.data);
    if (rulesRes.success) setRules(rulesRes.data);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleToggle = async (key: string, value: boolean) => {
    const res = await updateRoomToggles(params.id, { [key]: value });
    if (res.success) {
      setRoom(res.data);
      flash('Feature updated');
    } else setError(res.error);
  };

  const handleAccessSave = async () => {
    const extras = extraItems
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await updateRoomAccess(params.id, {
      access_level: accessLevel,
      allowed_roles: allowedRoles,
      item_allowlist: [
        ...allowlist,
        ...extras.filter((e) => !allowlist.includes(e)),
      ],
    });
    if (res.success) {
      setRoom(res.data);
      setEditingAccess(false);
      flash('Access settings saved');
    } else setError(res.error);
  };

  const handleRuleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await upsertAlertRule({
      room_id: params.id,
      metric: ruleForm.metric,
      op: ruleForm.op,
      threshold: Number(ruleForm.threshold),
      dwell_minutes: Number(ruleForm.dwell_minutes) || 0,
      severity: ruleForm.severity,
      notify_roles: ruleForm.notify_roles,
      active: true,
    });
    if (res.success) {
      setShowRuleForm(false);
      setRuleForm({
        metric: 'temperature',
        op: 'above',
        threshold: '',
        dwell_minutes: '0',
        severity: 'warning',
        notify_roles: [],
      });
      flash('Alert rule saved');
      void load();
    } else setError(res.error);
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading room…</div>;
  }
  if (!room) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {error ?? 'Room not found'}
      </div>
    );
  }

  const toggles: FeatureToggles = room.feature_toggles ?? {};
  const tempReadings = readings.filter((r) => r.metric === 'temperature');
  const latestTemp = tempReadings[tempReadings.length - 1]?.value ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/rooms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to rooms
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground">{room.name}</h1>
              <RoomTypeBadge type={room.type} />
              <AccessLevelBadge level={room.access_level} />
              {room.quarantine && (
                <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning text-xs font-medium">
                  quarantine
                </span>
              )}
              {!room.active && (
                <span className="px-2 py-0.5 rounded-full bg-input text-muted-foreground text-xs font-medium">
                  inactive
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1">
              {room.parent_name && (
                <>
                  in{' '}
                  <span className="font-medium">{room.parent_name}</span> ·{' '}
                </>
              )}
              {room.description ?? ''}
            </p>
          </div>
          {canEdit && (
            <Link
              href={`/dashboard/rooms/${room.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
            >
              <Edit className="h-4 w-4" /> Edit
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">{error}</div>
      )}
      {message && (
        <div className="p-4 rounded-lg bg-success/10 text-success">{message}</div>
      )}

      {/* Climate */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-muted-foreground" />
            Climate — last 24h
          </h2>
          <div className="text-sm text-muted-foreground">
            {latestTemp !== null ? (
              <>
                now <span className="font-semibold">{latestTemp.toFixed(1)}°C</span>
              </>
            ) : (
              'no data'
            )}
            {(room.temp_min !== null || room.temp_max !== null) && (
              <span className="text-muted-foreground">
                {' '}
                · range {room.temp_min ?? '−∞'}…{room.temp_max ?? '+∞'}°C
              </span>
            )}
          </div>
        </div>
        <ClimateChart
          readings={readings}
          tempMin={room.temp_min}
          tempMax={room.temp_max}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contents */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-muted-foreground" />
            Contents ({contents.length})
          </h2>
          {contents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products located here. Assign bin locations to this room to
              see its contents.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-muted-foreground uppercase border-b border-border">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2">Product</th>
                  <th className="pb-2">Bin</th>
                  <th className="pb-2 text-right">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contents.map((c) => (
                  <tr key={c.product_id}>
                    <td className="py-2 text-sm text-muted-foreground">{c.sku}</td>
                    <td className="py-2 text-sm text-foreground">{c.name}</td>
                    <td className="py-2 text-sm text-muted-foreground">{c.bin_label}</td>
                    <td className="py-2 text-sm text-foreground text-right">
                      {c.current_stock} {c.unit_of_measure}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {children.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">Sub-rooms</p>
              <div className="flex flex-wrap gap-2">
                {children.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/rooms/${c.id}`}
                    className="px-3 py-1.5 bg-muted hover:bg-input rounded-lg text-sm text-foreground"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feature toggles */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Room features
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {canEdit
              ? 'Toggle per-room capabilities.'
              : 'Per-room capabilities (read-only).'}
          </p>
          <div className="divide-y divide-border">
            {ROOM_FEATURES.map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground">{f.description}</p>
                </div>
                <ToggleSwitch
                  checked={toggles[f.key] ?? false}
                  onChange={(v) => handleToggle(f.key, v)}
                  disabled={!canEdit}
                  label={f.label}
                  id={`room-toggle-${f.key}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Access */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Access & allowlist
            </h2>
            {canEdit && !editingAccess && (
              <button
                onClick={() => setEditingAccess(true)}
                className="text-sm text-primary hover:underline"
              >
                Edit
              </button>
            )}
          </div>
          {!editingAccess ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access level</span>
                <AccessLevelBadge level={room.access_level} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Allowed roles</span>
                <span className="text-foreground">
                  {room.allowed_roles.length > 0
                    ? room.allowed_roles.join(', ')
                    : 'any'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item allowlist</span>
                <span className="text-foreground">
                  {room.item_allowlist.length > 0
                    ? room.item_allowlist.join(', ')
                    : 'all items'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Access level
                </label>
                <select
                  value={accessLevel}
                  onChange={(e) =>
                    setAccessLevel(e.target.value as RoomDTO['access_level'])
                  }
                  className={inputCls}
                >
                  {ROOM_ACCESS_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Allowed roles
                </label>
                <div className="flex flex-wrap gap-3">
                  {USER_ROLES.map((r) => (
                    <label
                      key={r}
                      className="inline-flex items-center gap-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={allowedRoles.includes(r)}
                        onChange={() =>
                          setAllowedRoles(
                            allowedRoles.includes(r)
                              ? allowedRoles.filter((v) => v !== r)
                              : [...allowedRoles, r],
                          )
                        }
                        className="rounded border-input"
                      />
                      {r.replace('_', ' ')}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Item allowlist
                </label>
                <div className="flex flex-wrap gap-3">
                  {ITEM_TYPES.map((t) => (
                    <label
                      key={t}
                      className="inline-flex items-center gap-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={allowlist.includes(t)}
                        onChange={() =>
                          setAllowlist(
                            allowlist.includes(t)
                              ? allowlist.filter((v) => v !== t)
                              : [...allowlist, t],
                          )
                        }
                        className="rounded border-input"
                      />
                      {t}
                    </label>
                  ))}
                </div>
                <input
                  value={extraItems}
                  onChange={(e) => setExtraItems(e.target.value)}
                  className={`${inputCls} mt-2`}
                  placeholder="Extra categories, comma-separated"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingAccess(false)}
                  className="px-3 py-1.5 border border-input rounded-lg text-sm hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAccessSave}
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
                >
                  Save access
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Alert rules */}
        <div className="bg-card rounded-lg border border-border shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              Alert rules ({rules.length})
            </h2>
            {canEdit && (
              <button
                onClick={() => setShowRuleForm(!showRuleForm)}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="h-4 w-4" /> Add rule
              </button>
            )}
          </div>

          {showRuleForm && canEdit && (
            <form
              onSubmit={handleRuleSave}
              className="mb-4 p-4 bg-muted rounded-lg space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={ruleForm.metric}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, metric: e.target.value })
                  }
                  className={inputCls}
                >
                  {SENSOR_METRICS.map((m) => (
                    <option key={m} value={m}>
                      {METRIC_LABELS[m]}
                    </option>
                  ))}
                </select>
                <select
                  value={ruleForm.op}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, op: e.target.value })
                  }
                  className={inputCls}
                >
                  {ALERT_THRESHOLD_OPS.map((o) => (
                    <option key={o} value={o}>
                      {o === 'above' ? 'rises above' : 'drops below'}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={ruleForm.threshold}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, threshold: e.target.value })
                  }
                  className={inputCls}
                  placeholder="Threshold"
                />
                <input
                  type="number"
                  min={0}
                  value={ruleForm.dwell_minutes}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, dwell_minutes: e.target.value })
                  }
                  className={inputCls}
                  placeholder="Dwell (min)"
                />
                <select
                  value={ruleForm.severity}
                  onChange={(e) =>
                    setRuleForm({ ...ruleForm, severity: e.target.value })
                  }
                  className={inputCls}
                >
                  {ALERT_SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-3">
                {USER_ROLES.map((r) => (
                  <label
                    key={r}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={ruleForm.notify_roles.includes(r)}
                      onChange={() =>
                        setRuleForm({
                          ...ruleForm,
                          notify_roles: ruleForm.notify_roles.includes(r)
                            ? ruleForm.notify_roles.filter((v) => v !== r)
                            : [...ruleForm.notify_roles, r],
                        })
                      }
                      className="rounded border-input"
                    />
                    notify {r.replace('_', ' ')}
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRuleForm(false)}
                  className="px-3 py-1.5 border border-input rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
                >
                  Save rule
                </button>
              </div>
            </form>
          )}

          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No alert rules — alerts won&apos;t fire for this room until a
              threshold rule exists.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div className="text-sm">
                    <span className="font-medium text-foreground">
                      {METRIC_LABELS[r.metric]}
                    </span>{' '}
                    <span className="text-muted-foreground">
                      {r.op} {r.threshold}
                    </span>
                    <span className="text-muted-foreground">
                      {' '}
                      · dwell {r.dwell_minutes}m ·{' '}
                    </span>
                    <span
                      className={
                        r.severity === 'critical'
                          ? 'text-destructive font-medium'
                          : r.severity === 'warning'
                            ? 'text-warning'
                            : 'text-muted-foreground'
                      }
                    >
                      {r.severity}
                    </span>
                    {!r.active && (
                      <span className="text-muted-foreground"> (disabled)</span>
                    )}
                  </div>
                  {canEdit && (
                    <button
                      onClick={async () => {
                        const res = await deleteAlertRule(r.id);
                        if (res.success) void load();
                        else setError(res.error);
                      }}
                      className="p-1 hover:bg-destructive/10 rounded text-destructive"
                      title="Delete rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
