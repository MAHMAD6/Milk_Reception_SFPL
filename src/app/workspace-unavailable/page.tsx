'use client';

import React, { useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { StatusScreen } from '@/components/ui/status-screen';

export default function WorkspaceUnavailablePage() {
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_err) {
      // Ignore network errors on logout
    }
    // Clear cookie client-side as well
    document.cookie = 'auth_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    window.location.href = '/login';
  };

  return (
    <StatusScreen
      tone="warning"
      icon={<ShieldAlert />}
      title="Workspace not available"
      description="Your role doesn't have an active workspace in this environment. Sign in with an authorized account or contact your administrator."
    >
      <Button onClick={handleLogout} disabled={signingOut}>
        {signingOut ? <Spinner className="text-primary-foreground" /> : <LogOut />}
        Sign out
      </Button>
    </StatusScreen>
  );
}
