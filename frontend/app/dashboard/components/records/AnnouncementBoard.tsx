'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Download, Eye } from 'lucide-react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';
import AnnouncementAttachments, { AnnouncementAttachment } from './AnnouncementAttachments';
import FloatingComposer from './FloatingComposer';
import FileAttachmentActions from './FileAttachmentActions';

const apiUrl = backendBaseUrl;

type Announcement = {
  id: string;
  type: 'announcement' | 'achievement';
  title: string;
  body: string;
  createdAt: string;
  author: string;
  attachments: AnnouncementAttachment[];
  review_status?: 'pending' | 'approved' | 'rejected';
  target_units?: string[];
  kind?: 'Мэдээлэл' | 'Зар';
  info_type?: 'Амжилт' | 'Оролцоо';
};

interface Props {
  boardType: 'Мэдээлэл' | 'Зар';
}

export default function AnnouncementBoard({ boardType }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [targetUnits, setTargetUnits] = useState<string[]>([]);
  const [infoType, setInfoType] = useState<'Амжилт' | 'Оролцоо'>('Амжилт');
  const [selected, setSelected] = useState<Announcement | null>(null);
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
    const response = await fetchWithAuth(`${apiUrl}/api/teachers/announcements`, {
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Дахин нэвтэрнэ үү.');
      const response = await fetchWithAuth(`${apiUrl}/api/teachers/announcements?kind=${encodeURIComponent(boardType)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? 'Мэдээлэл уншигдсангүй.');
      setAnnouncements(result as Announcement[]);
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
      const result = await request('POST', { title, body, attachments, target_units: targetUnits, kind: boardType, info_type: boardType === 'Мэдээлэл' ? infoType : null });
      setAnnouncements((current) => [result.announcement as Announcement, ...current]);
      setTitle('');
      setBody('');
      setAttachments([]);
      setTargetUnits([]);
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
      <h2 style={{ marginTop: 0 }}>{boardType}</h2>
      <FloatingComposer title={`${boardType} нэмэх`} label={`${boardType} нэмэх`}>
        {(close) => (
          <form onSubmit={(event) => void publish(event, close)} style={{ display: 'grid', gap: 10 }}>
          {boardType === 'Мэдээлэл' && <select value={infoType} onChange={(event) => setInfoType(event.target.value as 'Амжилт' | 'Оролцоо')} style={fieldStyle}><option>Амжилт</option><option>Оролцоо</option></select>}
          <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Гарчиг
            <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${boardType}-ийн гарчиг`} style={fieldStyle} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Агуулга
            <textarea required rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder={`${boardType}-ийн агуулга`} style={fieldStyle} />
          </label>
          <AnnouncementAttachments attachments={attachments} onChange={setAttachments} />
          <fieldset style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 8 }}>
            <legend>Хэнд харагдах</legend>
            {['БАЗАН', 'БУЗАН', 'НУЗАН'].map((unit) => <label key={unit} style={{ marginRight: 10 }}>
              <input type="checkbox" checked={targetUnits.includes(unit)} onChange={(event) => setTargetUnits((current) => event.target.checked ? [...current, unit] : current.filter((item) => item !== unit))} /> {unit}
            </label>)}
            <small style={{ display: 'block', color: '#64748b' }}>Юу ч сонгоогүй бол бүх багшид харагдана.</small>
          </fieldset>
          <button type="submit" disabled={busy} style={{ padding: '11px 14px', border: 0, borderRadius: 8, background: busy ? '#cbd5e1' : '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Нийтэлж байна...' : `${boardType} нийтлэх`}</button>
          </form>
        )}
      </FloatingComposer>
      {message && <p role="status">{message}</p>}
      {announcements.length === 0 ? <p>Одоогоор зар алга.</p> : (
        <div style={{ display: 'grid', gap: 8 }}>
          {announcements.map((announcement) => (
            <article key={announcement.id} onClick={() => setSelected(announcement)} style={{ display: 'flex', gap: 10, alignItems: 'stretch', padding: 9, border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', background: '#fff' }}>
              {announcement.attachments?.filter((attachment) => attachment.file_type === 'image').slice(0, 1).map((attachment) => (
                <div key={attachment.url} style={{ flex: '0 0 96px', display: 'flex', alignItems: 'center' }}>
                  <div className="announcement-image-preview" style={{ position: 'relative', width: 96, height: 68 }}>
                    <img src={attachment.url} alt={attachment.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                    <div className="announcement-image-actions" style={{ position: 'absolute', right: 4, bottom: 4, display: 'flex', gap: 3, opacity: 0.45, transition: 'opacity .2s' }}>
                      <button type="button" onClick={(event) => { event.stopPropagation(); setSelected(announcement); }} aria-label="Зураг харах" title="Зураг харах" style={imageActionButton}><Eye size={14} /></button>
                      <a href={attachment.url} download onClick={(event) => event.stopPropagation()} aria-label="Зураг татах" title="Зураг татах" style={imageActionButton}><Download size={14} /></a>
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ minWidth: 0, flex: 1 }}>
              <small style={{ color: announcement.type === 'achievement' ? '#047857' : '#2563eb' }}>
                {announcement.kind === 'Мэдээлэл' ? announcement.info_type ?? 'Мэдээлэл' : 'Зар'}
              </small>
              <h3 style={{ margin: '2px 0 4px', fontSize: 16 }}>{announcement.title}</h3>
              <p style={{ margin: '0 0 5px', whiteSpace: 'pre-wrap' }}>{announcement.body}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                {announcement.attachments?.filter((attachment) => attachment.file_type !== 'image').map((attachment) => <FileAttachmentActions key={attachment.url} attachment={attachment} showName={false} />)}
              </div>
              <small style={{ color: '#64748b' }}>{new Date(announcement.createdAt).toLocaleString('mn-MN')} · {announcement.author}</small>
              </div>
            </article>
          ))}
        </div>
      )}
      {selected && <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,23,42,.5)' }}>
        <section role="dialog" aria-modal="true" style={{ width: 'min(680px,100%)', maxHeight: '90vh', overflowY: 'auto', padding: 16, borderRadius: 14, background: '#fff', boxShadow: '0 24px 70px rgba(15,23,42,.3)' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}><h2 style={{ margin: 0 }}>{selected.title}</h2><button type="button" onClick={() => setSelected(null)} aria-label="Цонх хаах" style={{ border: 0, borderRadius: 8, padding: 8, cursor: 'pointer' }}>×</button></header>
          <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.body}</p>
          {selected.attachments?.filter((attachment) => attachment.file_type === 'image').map((attachment) => <img key={attachment.url} src={attachment.url} alt={attachment.name} style={{ display: 'block', maxWidth: '100%', maxHeight: 300, objectFit: 'contain', margin: '8px auto', borderRadius: 8 }} />)}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{selected.attachments?.filter((attachment) => attachment.file_type !== 'image').map((attachment) => <FileAttachmentActions key={attachment.url} attachment={attachment} />)}</div>
          <small style={{ color: '#64748b' }}>{selected.author} · {new Date(selected.createdAt).toLocaleString('mn-MN')}</small>
        </section>
      </div>}
    </section>
  );
}

const imageActionButton = {
  display: 'grid',
  placeItems: 'center',
  width: 20,
  height: 20,
  padding: 0,
  border: '1px solid rgba(255,255,255,.75)',
  borderRadius: 4,
  background: 'rgba(15,23,42,.72)',
  color: '#fff',
  cursor: 'pointer',
};
