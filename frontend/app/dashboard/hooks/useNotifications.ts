'use client';

import { useCallback, useEffect, useState } from 'react';
import { backendBaseUrl } from '../../../lib/backendApi';
import { supabase } from '../../../lib/supabaseClient';
import { DashboardCategory } from '../types';
import { countUnreadItems, fetchNotificationItems, NotificationItem, readReadItems } from './notificationData';

export type NotificationCounts = Partial<Record<DashboardCategory, number>>;

const apiUrl = backendBaseUrl;
const emptyItems: NotificationItem[] = [];

export function useNotifications(
  role: 'admin' | 'manager' | 'teacher',
  personalItems: NotificationItem[] = emptyItems,
  enabled = true,
) {
  const [items, setItems] = useState<NotificationItem[]>(personalItems);
  const [counts, setCounts] = useState<NotificationCounts>({});
  const [errorMessage, setErrorMessage] = useState('');
  const [userScope, setUserScope] = useState('unknown');
  const storageKey = typeof window === 'undefined' ? '' : `school-portal-notifications-${role}-${userScope}`;

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const mockToken = window.localStorage.getItem('school-portal-mock-token');
      const accessToken = session?.access_token ?? mockToken;
      if (!accessToken) return;
      const currentScope = session?.user.id ?? mockToken?.replace(/^mock:/, '') ?? 'unknown';
      const currentStorageKey = `school-portal-notifications-${role}-${currentScope}`;
      setUserScope(currentScope);
      const unique = await fetchNotificationItems(role, personalItems, accessToken);
      const read = readReadItems(currentStorageKey);
      setItems(unique);
      setCounts(countUnreadItems(unique, read));
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Мэдэгдэл уншигдсангүй.');
    }
  }, [enabled, personalItems, role, storageKey]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (!active || loading) return;
      loading = true;
      await load();
      loading = false;
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    void refresh();
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [enabled, load]);

  const markRead = useCallback((category: DashboardCategory) => {
    const read = readReadItems(storageKey);
    items.filter((item) => item.category === category).forEach((item) => read.add(`${category}:${item.id}`));
    window.localStorage.setItem(storageKey, JSON.stringify([...read]));
    setCounts((current) => ({ ...current, [category]: 0 }));
  }, [items, storageKey]);

  return { counts, errorMessage, markRead };
}
