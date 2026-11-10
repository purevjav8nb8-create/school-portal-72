'use client';

import { useCallback, useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { supabase } from '../../../lib/supabaseClient';
import { DashboardCategory } from '../types';

export type NotificationCounts = Partial<Record<DashboardCategory, number>>;
type NotificationItem = { id: string; category: DashboardCategory };
type AnnouncementRecord = { id?: string };
type SurveyRecord = { id?: string; response_ids?: string[] };
type TeacherRecord = {
  user_id?: string;
  trainings?: { id?: string }[];
  evaluations?: { id?: string }[];
  activities?: { id?: string }[];
  awards?: { id?: string }[];
  professional_degrees?: { id?: string }[];
  teaching_classes_updated_at?: string;
  program_plan?: { id?: string; submittedAt?: string };
};

const categories: DashboardCategory[] = ['Мэдээлэл', 'Зар', 'Судалгаа', 'Үнэлгээ', 'Сургалт', 'Шагнал', 'Зэрэг', 'Хянах', 'Чат'];
const apiUrl = backendBaseUrl;
const emptyItems: NotificationItem[] = [];

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Мэдэгдэл уншигдсангүй (${response.status}).`;
    try {
      const result = await response.json() as { detail?: string };
      detail = result.detail ?? detail;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new Error(detail);
  }
  return await response.json() as T;
}

function readReadItems(storageKey: string): Set<string> {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(stored) || stored.some((item) => typeof item !== 'string')) {
      throw new Error('Мэдэгдлийн уншсан төлөв буруу байна.');
    }
    return new Set(stored);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Мэдэгдлийн уншсан төлөвийг уншиж чадсангүй.');
    }
    throw error;
  }
}

export function useNotifications(role: 'admin' | 'teacher', personalItems: NotificationItem[] = emptyItems) {
  const [items, setItems] = useState<NotificationItem[]>(personalItems);
  const [counts, setCounts] = useState<NotificationCounts>({});
  const [errorMessage, setErrorMessage] = useState('');
  const storageKey = typeof window === 'undefined' ? '' : `school-portal-notifications-${role}`;

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const mockToken = window.localStorage.getItem('school-portal-mock-token');
      const accessToken = session?.access_token ?? mockToken;
      if (!accessToken) return;
      const headers = { Authorization: `Bearer ${accessToken}` };
      const announcementResponses = await Promise.all(
        (['Мэдээлэл', 'Зар'] as const).map((category) =>
          fetchWithAuth(`${apiUrl}/api/teachers/announcements?kind=${encodeURIComponent(category)}`, { headers }),
        ),
      );
      const announcementRecords = await Promise.all(
        announcementResponses.map((response) => readResponse<AnnouncementRecord[]>(response)),
      );
      const nextItems = role === 'admin' ? [...personalItems] : [];
      announcementRecords.forEach((records, index) => {
        const category = (['Мэдээлэл', 'Зар'] as const)[index];
        records.forEach((record) => {
          if (record.id) nextItems.push({ id: String(record.id), category });
        });
      });

      if (role === 'admin') {
        const [surveysResponse, reviewResponse] = await Promise.all([
          fetchWithAuth(`${apiUrl}/api/teachers/surveys`, { headers }),
          fetchWithAuth(`${apiUrl}/api/teachers/review`, { headers }),
        ]);
        const [surveys, teacherRecords] = await Promise.all([
          readResponse<SurveyRecord[]>(surveysResponse),
          readResponse<TeacherRecord[]>(reviewResponse),
        ]);
        const surveyIds = new Set<string>();
        surveys.forEach((survey) => {
          if (!survey.id) return;
          const surveyId = String(survey.id);
          if (surveyIds.has(surveyId)) return;
          surveyIds.add(surveyId);
          nextItems.push({ id: surveyId, category: 'Судалгаа' });
          survey.response_ids?.forEach((userId) =>
            nextItems.push({ id: `${surveyId}:${userId}`, category: 'Судалгаа' }),
          );
        });
        teacherRecords.forEach((record) => {
          if (!record.user_id) return;
          const addRecordNotifications = (
            records: { id?: string }[] | undefined,
            category: DashboardCategory,
          ) => records?.forEach((item) => {
            if (item.id) nextItems.push({ id: `${record.user_id}:${item.id}`, category });
          });
          addRecordNotifications(record.trainings, 'Сургалт');
          addRecordNotifications(record.evaluations, 'Үнэлгээ');
          addRecordNotifications(record.activities, 'Хянах');
          addRecordNotifications(record.awards, 'Хянах');
          addRecordNotifications(record.professional_degrees, 'Хянах');
          if (record.teaching_classes_updated_at) {
            nextItems.push({ id: `${record.user_id}:classes:${record.teaching_classes_updated_at}`, category: 'Хянах' });
          }
          if (record.program_plan) {
            const planId = record.program_plan.id ?? record.program_plan.submittedAt;
            if (planId) nextItems.push({ id: `${record.user_id}:${planId}`, category: 'Хянах' });
          }
        });
      }

      const unique = [...new Map(nextItems.map((item) => [`${item.category}:${item.id}`, item])).values()];
      const read = readReadItems(storageKey);
      setItems(unique);
      setCounts(Object.fromEntries(categories.map((category) => [
        category,
        unique.filter((item) => item.category === category && !read.has(`${category}:${item.id}`)).length,
      ])) as NotificationCounts);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Мэдэгдэл уншигдсангүй.');
    }
  }, [personalItems, role, storageKey]);

  useEffect(() => {
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
  }, [load]);

  const markRead = useCallback((category: DashboardCategory) => {
    const read = readReadItems(storageKey);
    items.filter((item) => item.category === category).forEach((item) => read.add(`${category}:${item.id}`));
    window.localStorage.setItem(storageKey, JSON.stringify([...read]));
    setCounts((current) => ({ ...current, [category]: 0 }));
  }, [items, storageKey]);

  return { counts, errorMessage, markRead };
}
