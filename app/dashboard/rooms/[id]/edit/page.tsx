'use client';

/**
 * /dashboard/rooms/[id]/edit — edit a storeroom (admin+manager; enforced
 * server-side by upsertRoom).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { getRoom, listRoomOptions } from '@/lib/actions/storerooms';
import type { RoomDTO, RoomOptionDTO } from '@/lib/storerooms/types';
import RoomForm from '../../_components/RoomForm';

export default function EditRoomPage() {
  const params = useParams<{ id: string }>();
  const { hasRole } = useAuth();
  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [options, setOptions] = useState<RoomOptionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canEdit = hasRole(['super_admin', 'admin', 'manager']);

  useEffect(() => {
    (async () => {
      const [roomRes, optRes] = await Promise.all([
        getRoom(params.id),
        listRoomOptions(),
      ]);
      if (roomRes.success) setRoom(roomRes.data.room);
      else setError(roomRes.error);
      if (optRes.success) setOptions(optRes.data);
      setLoading(false);
    })();
  }, [params.id]);

  if (!canEdit) {
    return (
      <div className="p-8 text-center text-gray-500">
        You need a manager or admin role to edit rooms.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href={`/dashboard/rooms/${params.id}`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to room
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">
          Edit {room?.name ?? 'Room'}
        </h1>
      </div>
      {error && <div className="p-4 rounded-lg bg-red-50 text-red-800">{error}</div>}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading…</div>
      ) : room ? (
        <RoomForm initial={room} roomOptions={options} />
      ) : null}
    </div>
  );
}
