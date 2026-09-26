'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@core/types';
import { Header } from '@modules/shared/Header';
import { HierarchicalNavDrawer } from '@modules/shared/navigation/HierarchicalNavDrawer';
import { MPDFieldWorkspace } from '@modules/dashboard/MPDFieldWorkspace';
import { RefreshCw } from 'lucide-react';
import { PageLoader } from '@/components/ui/spinner';
import { PageTransition } from '@/components/motion/page-transition';

function ZmccDispatchContent() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const hamburgerButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (!data.user) {
            router.push('/login');
            return;
          }
          const user = data.user;
          const isSuperAdmin = user.role === 'SUPER_ADMIN';
          const isLabAttendant = user.role === 'ZMCC_LAB_ATTENDANT';

          if (!isSuperAdmin && !isLabAttendant) {
            router.push('/workspace-unavailable');
            return;
          }

          if (!isSuperAdmin) {
            if (
              user.is_active === false ||
              !user.procurement_source_id ||
              !user.procurement_source ||
              user.procurement_source.is_active === false ||
              user.procurement_source.source_type !== 'ZMCC'
            ) {
              router.push('/workspace-unavailable');
              return;
            }
          }

          setCurrentUser(user);
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

  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setTimeout(() => {
      hamburgerButtonRef.current?.focus();
    }, 0);
  }, []);

  if (loading) {
    return (
      <PageLoader label="Loading ZMCC Dispatch Station…" className="min-h-screen" />
    );
  }

  if (!currentUser) {
    return null;
  }

  const assignedSourceName =
    currentUser.procurement_source?.name ||
    'Assigned ZMCC Source';

  return (
    <div className="w-full max-w-full flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Header
        currentUser={currentUser}
        sourceName={assignedSourceName}
        title="ZMCC Dispatch to Plant"
        showBranding={true}
        showMenuButton={true}
        onMenuClick={openDrawer}
        isZmccVariant={true}
        menuButtonRef={hamburgerButtonRef}
      />

      {/* Accessible Hierarchical Navigation Drawer */}
      <HierarchicalNavDrawer
        currentUser={currentUser}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        triggerButtonRef={hamburgerButtonRef}
      />

      {/* Main Responsive Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full max-w-full space-y-4">
          <PageTransition>
          <Suspense fallback={<PageLoader label="Loading dispatch workspace…" />}>
            <MPDFieldWorkspace currentUser={currentUser} />
          </Suspense>
          </PageTransition>
        </main>
      </div>
    </div>
  );
}

export default function ZmccDispatchPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading ZMCC Dispatch Station…" className="min-h-screen" />}>
      <ZmccDispatchContent />
    </Suspense>
  );
}
