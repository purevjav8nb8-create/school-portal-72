'use client';

import { useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';
import FileAttachmentActions from './FileAttachmentActions';

type Activity = {
  id: string;
  category: string;
  title: string;
  date: string;
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

  const activities = records.flatMap((record) => record.activities.map((activity) => ({ record, activity })));

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Оролцоо</h2>
      {errorMessage && <p role="alert" style={{ color: '#b91c1c' }}>{errorMessage}</p>}
      {loading ? <p>Оролцооны мэдээлэл ачаалж байна...</p> : activities.length === 0 ? <p>Одоогоор оролцооны мэдээлэл алга.</p> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {activities.map(({ record, activity }) => (
            <article key={`${record.user_id}-${activity.id}`} style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 10 }}>
              <strong>{activity.category}: {activity.title}</strong>
              <p style={{ margin: '6px 0', color: '#475569' }}>{record.teacher.name} · {record.teacher.email} · {record.teacher.unit}</p>
              <p style={{ margin: '6px 0' }}>{activity.date}{activity.note ? ` · ${activity.note}` : ''}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(activity.attachments ?? []).map((attachment) => <FileAttachmentActions key={attachment.url} attachment={attachment} />)}
                {(activity.images ?? []).map((url) => <FileAttachmentActions key={url} attachment={{ name: 'Зураг', url, file_type: 'image' }} />)}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
