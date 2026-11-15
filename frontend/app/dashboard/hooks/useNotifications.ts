'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const notificationsEnabled = enabled && role !== 'admin';
  const [items, setItems] = useState<NotificationItem[]>(personalItems);
  const [counts, setCounts] = useState<NotificationCounts>({});
  const [unreadItems, setUnreadItems] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const activeStorageKey = useRef('');
  const itemsLoaded = useRef(false);
  const pendingReadItems = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (!notificationsEnabled) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const mockToken = window.localStorage.getItem('school-portal-mock-token');
      const accessToken = session?.access_token ?? mockToken;
      if (!accessToken) return;
      const currentScope = session?.user.id ?? mockToken?.replace(/^mock:/, '') ?? 'unknown';
      const currentStorageKey = `school-portal-notifications-${role}-${currentScope}`;
      const legacyManagerStorageKey = `school-portal-notifications-admin-${currentScope}`;
      if (activeStorageKey.current !== currentStorageKey) itemsLoaded.current = false;
      activeStorageKey.current = currentStorageKey;
      const unique = await fetchNotificationItems(role, personalItems, accessToken);
      const hasCurrentReadState = window.localStorage.getItem(currentStorageKey) !== null;
      const read = hasCurrentReadState
        ? readReadItems(currentStorageKey)
        : role === 'manager'
          ? readReadItems(legacyManagerStorageKey)
          : new Set<string>();
      if (!hasCurrentReadState && role === 'manager' && read.size > 0) {
        window.localStorage.setItem(currentStorageKey, JSON.stringify([...read]));
      }
      pendingReadItems.current.forEach((itemKey) => read.add(itemKey));
      if (pendingReadItems.current.size > 0) {
        window.localStorage.setItem(currentStorageKey, JSON.stringify([...read]));
        pendingReadItems.current.clear();
      }
      setItems(unique);
      setCounts(countUnreadItems(unique, read));
      setUnreadItems(new Set(unique
        .filter((item) => !read.has(`${item.category}:${item.id}`))
        .map((item) => `${item.category}:${item.id}`)));
      itemsLoaded.current = true;
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error
        ? `Мэдэгдлийн мэдээлэл шинэчлэгдсэнгүй: ${error.message}`
        : 'Мэдэгдлийн мэдээлэл шинэчлэгдсэнгүй.');
    }
  }, [notificationsEnabled, personalItems, role]);

  useEffect(() => {
    if (!notificationsEnabled) return;
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
  }, [notificationsEnabled, load]);

  const markItemRead = useCallback((category: DashboardCategory, id: string) => {
    if (!notificationsEnabled) return;
    const itemKey = `${category}:${id}`;
    const currentStorageKey = activeStorageKey.current;
    if (!currentStorageKey || !itemsLoaded.current) {
      pendingReadItems.current.add(itemKey);
      return;
    }
    const read = readReadItems(currentStorageKey);
    read.add(itemKey);
    window.localStorage.setItem(currentStorageKey, JSON.stringify([...read]));
    setCounts(countUnreadItems(items, read));
    setUnreadItems(new Set(items
      .filter((item) => !read.has(`${item.category}:${item.id}`))
      .map((item) => `${item.category}:${item.id}`)));
  }, [items, notificationsEnabled]);

  return { counts, unreadItems, errorMessage, markItemRead };
}
