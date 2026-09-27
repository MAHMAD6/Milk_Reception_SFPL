'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductionUnloadingWorkspace, ProductionTab } from '@modules/dashboard/ProductionUnloadingWorkspace';
import { Header } from '@modules/shared/Header';
import { HierarchicalNavDrawer } from '@modules/shared/navigation/HierarchicalNavDrawer';
import { User } from '@core/types';
import { PageLoader } from '@/components/ui/spinner';
import { PageTransition } from '@/components/motion/page-transition';
import { resolveRoleHome } from '@/lib/role-routing';

function ProductionDepartmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hamburgerButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          const roleStr = data.user?.role as string;
          const allowedRoles = ['PRODUCTION_RECEPTION_OPERATOR', 'PRODUCTION_HEAD', 'SUPER_ADMIN'];
          if (data.user && allowedRoles.includes(roleStr)) {
            setUser(data.user);
            setIsAuthorized(true);
          } else {
            router.replace(data.user ? resolveRoleHome(roleStr) : '/login');
          }
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Failed to load user', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setTimeout(() => hamburgerButtonRef.current?.focus(), 0);
  }, []);

  const tabParam = searchParams?.get('tab')?.toUpperCase() || 'READY';
  const resolvedTab: ProductionTab =
    tabParam === 'UNLOADING' || tabParam === 'SILO_ISSUE'
      ? (tabParam as ProductionTab)
      : 'READY';

  if (loading) {
    return (
      <PageLoader label="Loading Production Workstation…" className="min-h-screen" />
    );
  }

  if (!isAuthorized || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col w-full max-w-full overflow-x-hidden">
      <Header
        currentUser={user}
        title="Production"
        showBranding={true}
        showMenuButton={true}
        onMenuClick={openDrawer}
        menuButtonRef={hamburgerButtonRef}
      />

      <HierarchicalNavDrawer
        currentUser={user}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        triggerButtonRef={hamburgerButtonRef}
      />

      <main className="flex-1 p-4 sm:p-6 overflow-y-auto w-full max-w-full">
        <PageTransition>
        <ProductionUnloadingWorkspace
          currentUser={user}
          activeTab={resolvedTab}
          onTabChange={(tab) => {
            router.push(`/department/production?tab=${tab}`);
          }}
        />
        </PageTransition>
      </main>
    </div>
  );
}

export default function ProductionDepartmentPage() {
  return (
    <Suspense
      fallback={
        <PageLoader label="Loading Production Workstation…" className="min-h-screen" />
      }
    >
      <ProductionDepartmentContent />
    </Suspense>
  );
}
