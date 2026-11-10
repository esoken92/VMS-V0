'use client';

/**
 * badges — room type / access-level / temp-status pill styling shared by
 * the rooms list and room detail pages.
 */

import type { RoomAccessLevel, RoomType } from '@/lib/storerooms/room-types';
import { roomTypeLabel } from '@/lib/storerooms/room-types';

const TYPE_STYLES: Record<RoomType, string> = {
  general: 'bg-gray-100 text-gray-700',
  cold: 'bg-sky-100 text-sky-800',
  frozen: 'bg-indigo-100 text-indigo-800',
  dry: 'bg-amber-100 text-amber-800',
  it: 'bg-violet-100 text-violet-800',
  vehicle: 'bg-teal-100 text-teal-800',
  secure: 'bg-slate-800 text-slate-100',
  hazmat: 'bg-orange-100 text-orange-800',
  quarantine: 'bg-yellow-100 text-yellow-800',
  staging: 'bg-emerald-100 text-emerald-800',
  dock: 'bg-cyan-100 text-cyan-800',
  returns: 'bg-pink-100 text-pink-800',
  destruction: 'bg-red-100 text-red-800',
};

const ACCESS_STYLES: Record<RoomAccessLevel, string> = {
  open: 'bg-green-100 text-green-800',
  restricted: 'bg-amber-100 text-amber-800',
  secure: 'bg-slate-800 text-slate-100',
  locked: 'bg-red-100 text-red-800',
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
      ? 'bg-green-500'
      : status === 'low' || status === 'high'
        ? 'bg-red-500'
        : 'bg-gray-300';
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
