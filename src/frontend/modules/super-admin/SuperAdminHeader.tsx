'use client';

import React from 'react';
import { User } from '@core/types';
import { usePathname } from 'next/navigation';
import { Header } from '@/frontend/modules/shared/Header';
import { SUPER_ADMIN_NAV_ITEMS } from './SuperAdminSidebar';

interface SuperAdminHeaderProps {
  currentUser: User | null;
  onMenuClick?: () => void;
  isOpen?: boolean;
  menuButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export const SuperAdminHeader: React.FC<SuperAdminHeaderProps> = ({ currentUser, onMenuClick, menuButtonRef }) => {
  const pathname = usePathname();
  const current =
    SUPER_ADMIN_NAV_ITEMS.find((item) => item.href === pathname) ??
    SUPER_ADMIN_NAV_ITEMS.find((item) => item.href !== '/super-admin' && pathname.startsWith(item.href));

  return (
    <Header
      currentUser={currentUser}
      title={current?.label ?? 'Administration'}
      showBranding
      onMenuClick={onMenuClick}
      menuButtonRef={menuButtonRef}
    />
  );
};
