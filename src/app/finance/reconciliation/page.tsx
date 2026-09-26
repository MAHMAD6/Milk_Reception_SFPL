'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/backend/core/types';
import { StationShell } from '@/frontend/modules/shared/StationShell';
import { PageLoader } from '@/components/ui/spinner';
import { FinanceReconciliationWorkspace } from '@/frontend/modules/finance/FinanceReconciliationWorkspace';

export default function FinanceReconciliationPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.user) return router.replace('/login');
        if (!['FINANCE_ACCOUNTS', 'SUPER_ADMIN'].includes(body.user.role)) return router.replace('/workspace-unavailable');
        setUser(body.user);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!user) return <PageLoader label="Verifying finance access…" className="min-h-screen" />;

  return (
    <StationShell currentUser={user} title="Finance Reconciliation" mainClassName="max-w-7xl">
      <FinanceReconciliationWorkspace />
    </StationShell>
  );
}
