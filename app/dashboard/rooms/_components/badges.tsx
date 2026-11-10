'use client';

/**
 * badges — room type / access-level / temp-status pill styling shared by
 * the rooms list and room detail pages.
 */

import type { RoomAccessLevel, RoomType } from '@/lib/storerooms/room-types';
import { roomTypeLabel } from '@/lib/storerooms/room-types';

const TYPE_STYLES: Record<RoomType, string> = {
  general: 'bg-muted text-foreground',
  cold: 'bg-sky-100 text-sky-800',
  frozen: 'bg-info/10 text-info',
  dry: 'bg-warning/15 text-warning',
  it: 'bg-violet-100 text-violet-800',
  vehicle: 'bg-teal-100 text-teal-800',
  secure: 'bg-slate-800 text-slate-100',
  hazmat: 'bg-orange-100 text-orange-800',
  quarantine: 'bg-warning/15 text-warning',
  staging: 'bg-success/10 text-success',
  dock: 'bg-cyan-100 text-cyan-800',
  returns: 'bg-pink-100 text-pink-800',
  destruction: 'bg-destructive/10 text-destructive',
};

const ACCESS_STYLES: Record<RoomAccessLevel, string> = {
  open: 'bg-success/10 text-success',
  restricted: 'bg-warning/15 text-warning',
  secure: 'bg-slate-800 text-slate-100',
  locked: 'bg-destructive/10 text-destructive',
};

export function RoomTypeBadge({ type }: { type: RoomType }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLES[type]}`}
    >
      {roomTypeLabel(type)}
    </span>
  );
}

export function AccessLevelBadge({ level }: { level: RoomAccessLevel }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACCESS_STYLES[level]}`}
    >
      {level}
    </span>
  );
}

export function TempStatusDot({
  status,
}: {
  status: 'ok' | 'low' | 'high' | 'unknown';
}) {
  const style =
    status === 'ok'
      ? 'bg-success'
      : status === 'low' || status === 'high'
        ? 'bg-destructive/100'
        : 'bg-input';
  const title =
    status === 'ok'
      ? 'Within range'
      : status === 'low'
        ? 'Below minimum'
        : status === 'high'
          ? 'Above maximum'
          : 'No data';
  return (
    <span
      title={title}
      className={`inline-block h-2.5 w-2.5 rounded-full ${style}`}
    />
  );
}
