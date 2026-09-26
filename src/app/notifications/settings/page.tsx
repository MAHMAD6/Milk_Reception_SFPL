'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/backend/core/types';
import { StationShell } from '@/frontend/modules/shared/StationShell';
import { PageLoader } from '@/components/ui/spinner';
import { NotificationDeviceSettings } from '@/frontend/modules/notifications/NotificationDeviceSettings';

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.user) return router.replace('/login');
        setUser(body.user);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!user) return <PageLoader label="Verifying access…" className="min-h-screen" />;

  return (
    <StationShell currentUser={user} title="Notification Settings" mainClassName="max-w-3xl">
      <NotificationDeviceSettings />
    </StationShell>
  );
}
