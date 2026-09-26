'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/backend/core/types';
import { PageLoader } from '@/components/ui/spinner';
import { SuperAdminDeviceSubscriptions } from '@/frontend/modules/notifications/SuperAdminDeviceSubscriptions';

// Rendered inside the super-admin layout, which already provides the header and navigation.
export default function NotificationDevicesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.user) return router.replace('/login');
        if (body.user.role !== 'SUPER_ADMIN') return router.replace('/workspace-unavailable');
        setUser(body.user);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!user) return <PageLoader label="Verifying access…" />;

  return (
    <div className="mx-auto max-w-6xl">
      <SuperAdminDeviceSubscriptions />
    </div>
  );
}
