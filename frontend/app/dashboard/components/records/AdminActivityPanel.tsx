'use client';

import { useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';
import ActivityFeed, { ActivityFeedItem } from './ActivityFeed';

type Activity = {
  id: string;
  category: string;
  title: string;
  date: string;
  submittedAt?: string;
  note: string;
  attachments?: { name: string; url: string; file_type: 'image' | 'document' }[];
  images?: string[];
};

type TeacherRecord = {
  user_id: string;
  teacher: { name: string; email: string; unit: string };
  activities: Activity[];
};

export default function AdminActivityPanel() {
  const [records, setRecords] = useState<TeacherRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const request = async (path: string, method = 'GET', body?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Дахин нэвтэрнэ үү.');
    const response = await fetchWithAuth(`${backendBaseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Оролцооны мэдээлэл уншигдсангүй.');
    return result;
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const result = await request('/api/teachers/review');
      setRecords(Array.isArray(result) ? result : []);
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Оролцооны мэдээлэл уншигдсангүй.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRecords(); }, []);

  const activities: ActivityFeedItem[] = records.flatMap((record) => record.activities.map((activity) => ({
    ...activity,
    id: `${record.user_id}-${activity.id}`,
    author: record.teacher.name || record.teacher.email,
  }))).sort((left, right) => (right.submittedAt ?? right.date).localeCompare(left.submittedAt ?? left.date));

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Оролцоо</h2>
      {errorMessage && <p role="alert" style={{ color: '#b91c1c' }}>{errorMessage}</p>}
      {loading
        ? <p>Оролцооны мэдээлэл ачаалж байна...</p>
        : activities.length === 0
          ? <p>Одоогоор оролцооны мэдээлэл алга.</p>
          : <ActivityFeed activities={activities} />}
    </section>
  );
}
