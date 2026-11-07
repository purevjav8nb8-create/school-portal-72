'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';
import AnnouncementAttachments, { AnnouncementAttachment } from './AnnouncementAttachments';
import FloatingComposer from './FloatingComposer';
import FileAttachmentActions from './FileAttachmentActions';

const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

type Announcement = {
  id: string;
  type: 'announcement' | 'achievement';
  title: string;
  body: string;
  createdAt: string;
  author: string;
  attachments: AnnouncementAttachment[];
  review_status?: 'pending' | 'approved' | 'rejected';
};

export default function AnnouncementBoard() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fieldStyle = {
    width: '100%',
    padding: '11px 12px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#fff',
    color: '#172033',
    boxSizing: 'border-box' as const,
  };

  const request = async (method = 'GET', payload?: object) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Дахин нэвтэрнэ үү.');
    const response = await fetch(`${apiUrl}/api/teachers/announcements`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Зар уншигдсангүй.');
    return result;
  };

  const loadAnnouncements = async () => {
    try {
      setAnnouncements(await request() as Announcement[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Зар уншигдсангүй.');
    }
  };

  useEffect(() => { void loadAnnouncements(); }, []);

  const publish = async (event: FormEvent<HTMLFormElement>, close: () => void) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await request('POST', { title, body, attachments });
      setAnnouncements((current) => [result.announcement as Announcement, ...current]);
      setTitle('');
      setBody('');
      setAttachments([]);
      setMessage('Зар нийтлэгдлээ.');
      close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Зар нийтлэгдсэнгүй.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Сургуулийн зар</h2>
      <FloatingComposer title="Зар нэмэх" label="Зар нэмэх">
        {(close) => (
          <form onSubmit={(event) => void publish(event, close)} style={{ display: 'grid', gap: 10 }}>
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Зарын гарчиг" style={fieldStyle} />
          <textarea required rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Зарын мэдээлэл" style={fieldStyle} />
          <AnnouncementAttachments attachments={attachments} onChange={setAttachments} />
          <button type="submit" disabled={busy} style={{ padding: '11px 14px', border: 0, borderRadius: 8, background: busy ? '#cbd5e1' : '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Нийтэлж байна...' : 'Зар нийтлэх'}</button>
          </form>
        )}
      </FloatingComposer>
      {message && <p role="status">{message}</p>}
      {announcements.length === 0 ? <p>Одоогоор зар алга.</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {announcements.map((announcement) => (
            <article key={announcement.id} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <small style={{ color: announcement.type === 'achievement' ? '#047857' : '#2563eb' }}>
                {announcement.type === 'achievement' ? 'Амжилт' : 'Зар'}
              </small>
              <h3 style={{ margin: '0 0 6px' }}>{announcement.title}</h3>
              <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{announcement.body}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                {announcement.attachments?.map((attachment) => <FileAttachmentActions key={attachment.url} attachment={attachment} />)}
              </div>
              <small style={{ color: '#64748b' }}>{new Date(announcement.createdAt).toLocaleString('mn-MN')} · {announcement.author}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
