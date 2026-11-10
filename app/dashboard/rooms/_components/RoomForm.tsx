'use client';

/**
 * RoomForm — create/edit storeroom. Shared by /dashboard/rooms/new and
 * /dashboard/rooms/[id]/edit.
 *
 * Changing `type` offers the type's presets (getRoomTypeDefaults): temp
 * range, access level, quarantine flag and the feature-toggle set — every
 * field stays editable afterwards.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { USER_ROLES, ITEM_TYPES } from '@/lib/auth/roles';
import {
  ROOM_ACCESS_LEVELS,
  ROOM_FEATURES,
  ROOM_TYPES,
  getRoomTypeDefaults,
  roomTypeLabel,
} from '@/lib/storerooms/room-types';
import { upsertRoom } from '@/lib/actions/storerooms';
import type {
  FeatureToggles,
  RoomDTO,
  RoomOptionDTO,
} from '@/lib/storerooms/types';
import ToggleSwitch from './ToggleSwitch';

interface RoomFormProps {
  /** Present → edit mode; absent → create. */
  initial?: RoomDTO;
  /** Candidate parent rooms (self already excluded server-side ideally). */
  roomOptions: RoomOptionDTO[];
}

const inputCls =
  'w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary';

export default function RoomForm({ initial, roomOptions }: RoomFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<RoomDTO['type']>(initial?.type ?? 'general');
  const [parentId, setParentId] = useState(initial?.parent_id ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [tempMin, setTempMin] = useState(
    initial?.temp_min !== null && initial?.temp_min !== undefined
      ? String(initial.temp_min)
      : '',
  );
  const [tempMax, setTempMax] = useState(
    initial?.temp_max !== null && initial?.temp_max !== undefined
      ? String(initial.temp_max)
      : '',
  );
  const [capacity, setCapacity] = useState(
    initial?.capacity_units !== null && initial?.capacity_units !== undefined
      ? String(initial.capacity_units)
      : '',
  );
  const [accessLevel, setAccessLevel] = useState<RoomDTO['access_level']>(
    initial?.access_level ?? 'open',
  );
  const [allowedRoles, setAllowedRoles] = useState<string[]>(
    initial?.allowed_roles ?? [],
  );
  const [itemAllowlist, setItemAllowlist] = useState<string[]>(
    initial?.item_allowlist ?? [],
  );
  const [extraItems, setExtraItems] = useState(
    (initial?.item_allowlist ?? [])
      .filter((i) => !(ITEM_TYPES as readonly string[]).includes(i))
      .join(', '),
  );
  const [toggles, setToggles] = useState<FeatureToggles>(() => ({
    ...getRoomTypeDefaults(initial?.type ?? 'general').feature_toggles,
    ...(initial?.feature_toggles ?? {}),
  }));
  const [quarantine, setQuarantine] = useState(initial?.quarantine ?? false);
  const [active, setActive] = useState(initial?.active ?? true);

  const applyTypeDefaults = (newType: RoomDTO['type']) => {
    const d = getRoomTypeDefaults(newType);
    setTempMin(d.temp_min === null ? '' : String(d.temp_min));
    setTempMax(d.temp_max === null ? '' : String(d.temp_max));
    setAccessLevel(d.access_level);
    setQuarantine(d.quarantine);
    setToggles({ ...d.feature_toggles });
  };

  const handleTypeChange = (newType: RoomDTO['type']) => {
    setType(newType);
    if (!initial) applyTypeDefaults(newType);
  };

  const toggleArrayValue = (
    arr: string[],
    value: string,
    setter: (v: string[]) => void,
  ) => {
    setter(
      arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const extras = extraItems
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const mergedAllowlist = [
        ...itemAllowlist,
        ...extras.filter((e) => !itemAllowlist.includes(e)),
      ];

      const result = await upsertRoom({
        ...(initial ? { id: initial.id } : {}),
        name,
        type,
        parent_id: parentId || null,
        description: description || null,
        temp_min: tempMin === '' ? null : Number(tempMin),
        temp_max: tempMax === '' ? null : Number(tempMax),
        capacity_units: capacity === '' ? null : Number(capacity),
        access_level: accessLevel,
        allowed_roles: allowedRoles,
        item_allowlist: mergedAllowlist,
        feature_toggles: toggles,
        quarantine,
        active,
      });
      if (!result.success) throw new Error(result.error);
      router.push(`/dashboard/rooms/${result.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  };

  // Exclude self from parent options (cycles deeper than self are checked
  // server-side too).
  const parentOptions = roomOptions.filter((o) => o.id !== initial?.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive">{error}</div>
      )}

      <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Room details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Name *
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="e.g., Cold Store A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Type *
            </label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as RoomDTO['type'])}
              className={inputCls}
            >
              {ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {roomTypeLabel(t)} ({t})
                </option>
              ))}
            </select>
            {!initial && (
              <p className="mt-1 text-xs text-muted-foreground">
                Changing type applies that type&apos;s default temp range,
                access level and features — all editable below.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Parent room
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={inputCls}
            >
              <option value="">— none (top level) —</option>
              {parentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Capacity (units)
            </label>
            <input
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputCls}
            rows={2}
            placeholder="Optional description…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Temp min (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={tempMin}
              onChange={(e) => setTempMin(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Temp max (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={tempMax}
              onChange={(e) => setTempMax(e.target.value)}
              className={inputCls}
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {/* Access */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Access</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="flex flex-wrap gap-3 pt-1">
              {USER_ROLES.map((r) => (
                <label
                  key={r}
                  className="inline-flex items-center gap-1.5 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={allowedRoles.includes(r)}
                    onChange={() =>
                      toggleArrayValue(allowedRoles, r, setAllowedRoles)
                    }
                    className="rounded border-input"
                  />
                  {r.replace('_', ' ')}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Empty = no role restriction.
            </p>
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
                className="inline-flex items-center gap-1.5 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={itemAllowlist.includes(t)}
                  onChange={() =>
                    toggleArrayValue(itemAllowlist, t, setItemAllowlist)
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
            placeholder="Extra categories, comma-separated (optional)"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Empty = all item types allowed.
          </p>
        </div>
      </div>

      {/* Feature toggles */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Room features
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Per-room capabilities — disabling a feature also disables its
          server-side behaviour (e.g. threshold_alerts stops alert evaluation).
        </p>
        <div className="divide-y divide-border">
          {ROOM_FEATURES.map((f) => (
            <div key={f.key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{f.label}</p>
                <p className="text-xs text-muted-foreground">{f.description}</p>
              </div>
              <ToggleSwitch
                checked={toggles[f.key] ?? false}
                onChange={(v) => setToggles({ ...toggles, [f.key]: v })}
                label={f.label}
                id={`toggle-${f.key}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Flags */}
      <div className="bg-card rounded-lg border border-border shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Quarantine</p>
            <p className="text-xs text-muted-foreground">
              Stock here is held for inspection.
            </p>
          </div>
          <ToggleSwitch
            checked={quarantine}
            onChange={setQuarantine}
            label="Quarantine"
            id="toggle-quarantine"
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-xs text-muted-foreground">
              Inactive rooms are hidden from pickers and the simulator.
            </p>
          </div>
          <ToggleSwitch
            checked={active}
            onChange={setActive}
            label="Active"
            id="toggle-active"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-input rounded-lg hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving…' : initial ? 'Update room' : 'Create room'}
        </button>
      </div>
    </form>
  );
}
