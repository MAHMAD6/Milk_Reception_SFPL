'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@core/types';
import { SuperAdminSidebar } from '@/frontend/modules/super-admin/SuperAdminSidebar';
import { SuperAdminHeader } from '@/frontend/modules/super-admin/SuperAdminHeader';
import { resolveRoleHome } from '@/lib/role-routing';
import { PageLoader } from '@/components/ui/spinner';
import { PageTransition } from '@/components/motion/page-transition';

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hamburgerButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (res.ok && data.user) {
          const role = data.user.role;
          const allowedRoles = [
            'SUPER_ADMIN',
            'SYSTEM_ADMIN',
            'DATA_EXECUTIVE',
            'DATA_ANALYST',
            'EXECUTIVE_MANAGEMENT',
            'ADMIN_HEAD',
            'FINANCE_ACCOUNTS',
            'QA_HEAD',
            'PRODUCTION_HEAD',
            'HEAD_OF_MPD',
          ];
          if (allowedRoles.includes(role)) {
            setCurrentUser(data.user);
            setIsAuthorized(true);
          } else {
            router.replace(resolveRoleHome(role));
          }
        } else {
          router.replace('/login');
        }
      } catch (_err) {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <PageLoader label="Verifying access…" className="min-h-screen" />
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col bg-background text-foreground">
      <SuperAdminHeader
        currentUser={currentUser}
        isOpen={isDrawerOpen}
        onMenuClick={() => setIsDrawerOpen(true)}
        menuButtonRef={hamburgerButtonRef}
      />
      <SuperAdminSidebar
        currentUser={currentUser}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        triggerRef={hamburgerButtonRef}
      />
      <main className="w-full max-w-full flex-1 p-4 sm:p-6 lg:p-8">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
