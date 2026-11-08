'use client';

import { useCallback, useEffect, useState } from 'react';
import { backendBaseUrl } from '../../../lib/backendApi';
import { supabase } from '../../../lib/supabaseClient';
import { DashboardCategory } from '../types';

export type NotificationCounts = Partial<Record<DashboardCategory, number>>;
type NotificationItem = { id: string; category: DashboardCategory };

const categories: DashboardCategory[] = ['Мэдээлэл', 'Зар', 'Судалгаа', 'Үнэлгээ', 'Шагнал', 'Зэрэг'];
const apiUrl = backendBaseUrl;
const emptyItems: NotificationItem[] = [];

export function useNotifications(role: 'admin' | 'teacher', personalItems: NotificationItem[] = emptyItems) {
  const [items, setItems] = useState<NotificationItem[]>(personalItems);
  const [counts, setCounts] = useState<NotificationCounts>({});
  const storageKey = typeof window === 'undefined' ? '' : `school-portal-notifications-${role}`;

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const headers = { Authorization: `Bearer ${session.access_token}` };
    const nextItems = role === 'admin' ? [...personalItems] : [];
    for (const category of ['Мэдээлэл', 'Зар'] as const) {
      const response = await fetch(`${apiUrl}/api/teachers/announcements?kind=${encodeURIComponent(category)}`, { headers });
      if (response.ok) {
        const records = await response.json() as { id?: string }[];
        records.forEach((record) => record.id && nextItems.push({ id: String(record.id), category }));
      }
    }
    if (role === 'admin') {
      const surveysResponse = await fetch(`${apiUrl}/api/teachers/surveys`, { headers });
      if (surveysResponse.ok) {
        const records = await surveysResponse.json() as { id?: string; response_ids?: string[] }[];
        const surveyIds = new Set<string>();
        records.forEach((record) => {
          if (!record.id) return;
          const surveyId = String(record.id);
          if (surveyIds.has(surveyId)) return;
          surveyIds.add(surveyId);
          nextItems.push({ id: surveyId, category: 'Судалгаа' });
          record.response_ids?.forEach((userId) => nextItems.push({ id: `${surveyId}:${userId}`, category: 'Судалгаа' }));
        });
      }
    }
    if (role === 'admin') {
      const reviewResponse = await fetch(`${apiUrl}/api/teachers/review`, { headers });
      if (reviewResponse.ok) {
        const records = await reviewResponse.json() as { user_id?: string; evaluations?: { id?: string }[]; awards?: { id?: string }[]; professional_degrees?: { id?: string }[] }[];
        records.forEach((record) => {
          if (record.user_id && record.evaluations?.length) {
            nextItems.push({ id: record.user_id, category: 'Үнэлгээ' });
          }
          if (record.user_id && record.awards?.length) {
            nextItems.push({ id: record.user_id, category: 'Шагнал' });
          }
          if (record.user_id && record.professional_degrees?.length) {
            nextItems.push({ id: record.user_id, category: 'Зэрэг' });
          }
        });
      }
    }
    const unique = [...new Map(nextItems.map((item) => [`${item.category}:${item.id}`, item])).values()];
    const read = new Set<string>(JSON.parse(window.localStorage.getItem(storageKey) ?? '[]'));
    setItems(unique);
    setCounts(Object.fromEntries(categories.map((category) => [category, unique.filter((item) => item.category === category && !read.has(`${category}:${item.id}`)).length])) as NotificationCounts);
  }, [personalItems, role, storageKey]);

  useEffect(() => { void load(); }, [load]);

  const markRead = useCallback((category: DashboardCategory) => {
    const read = new Set<string>(JSON.parse(window.localStorage.getItem(storageKey) ?? '[]'));
    items.filter((item) => item.category === category).forEach((item) => read.add(`${category}:${item.id}`));
    window.localStorage.setItem(storageKey, JSON.stringify([...read]));
    setCounts((current) => ({ ...current, [category]: 0 }));
  }, [items, storageKey]);

  return { counts, markRead };
}
