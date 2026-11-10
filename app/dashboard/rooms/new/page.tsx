'use client';

/**
 * /dashboard/rooms/new — create a storeroom (admin+manager; the server
 * action enforces it — this page just hides the form from other roles).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { listRoomOptions } from '@/lib/actions/storerooms';
import type { RoomOptionDTO } from '@/lib/storerooms/types';
import RoomForm from '../_components/RoomForm';

export default function NewRoomPage() {
  const { hasRole } = useAuth();
  const [options, setOptions] = useState<RoomOptionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const canEdit = hasRole(['super_admin', 'admin', 'manager']);

  useEffect(() => {
    (async () => {
      const res = await listRoomOptions();
      if (res.success) setOptions(res.data);
      setLoading(false);
    })();
  }, []);

  if (!canEdit) {
    return (
      <div className="p-8 text-center text-gray-500">
        You need a manager or admin role to create rooms.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link
          href="/dashboard/rooms"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to rooms
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">New Storeroom</h1>
      </div>
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading…</div>
      ) : (
        <RoomForm roomOptions={options} />
      )}
    </div>
  );
}
