'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Settings, ArrowUpRight, Inbox } from 'lucide-react';
import { User } from '@core/types';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface NotificationItem {
  id: string;
  eventKey: string;
  priority: string;
  title: string;
  body: string;
  deepLink: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationBellProps {
  currentUser: User | null;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data?.notifications || []);
        setUnreadCount(Number(data?.unreadCount || 0));
      } else if (res.status === 401) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (_err) {
      // Ignore network errors during polling
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      setUnreadCount(0);
      setIsOpen(false);
      return;
    }

    fetchNotifications();
    const interval = window.setInterval(fetchNotifications, 60000);

    const handleLoggedOut = () => {
      setNotifications([]);
      setUnreadCount(0);
      setIsOpen(false);
      clearInterval(interval);
    };

    window.addEventListener('milk-user-logged-out', handleLoggedOut);

    return () => {
      clearInterval(interval);
      window.removeEventListener('milk-user-logged-out', handleLoggedOut);
    };
  }, [currentUser, fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (_err) {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.readAt) {
      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (_err) {
        // Ignore
      }
    }

    setIsOpen(false);

    if (
      item.deepLink &&
      item.deepLink.startsWith('/') &&
      !item.deepLink.startsWith('//') &&
      !item.deepLink.includes('://')
    ) {
      window.location.assign(item.deepLink);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-foreground"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-card">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="flex w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>

        <div className="scrollbar-thin max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Inbox className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">You&apos;re all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">New plant events will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((item) => {
                const isUnread = !item.readAt;
                const isHighPriority = item.priority === 'HIGH' || item.priority === 'URGENT';

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className={cn(
                        'flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
                        isUnread && 'bg-primary/[0.03]'
                      )}
                    >
                      <span
                        className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', isUnread ? 'bg-primary' : 'bg-transparent')}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={cn('truncate text-sm', isUnread ? 'font-medium text-foreground' : 'text-slate-600')}>
                            {item.title}
                          </span>
                          {isHighPriority && (
                            <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700">
                              {item.priority}
                            </span>
                          )}
                        </span>
                        <span className="line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>
                        <span className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="tabular-nums">
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : ''}
                          </span>
                          {item.deepLink && (
                            <span className="inline-flex items-center gap-0.5 font-medium text-primary">
                              Open
                              <ArrowUpRight className="h-3 w-3" />
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-subtle px-4 py-2.5 text-xs">
          <Link
            href="/notifications/settings"
            onClick={() => setIsOpen(false)}
            className="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          <span className="text-muted-foreground">Refreshes every minute</span>
        </div>
      </PopoverContent>
    </Popover>
  );
};
