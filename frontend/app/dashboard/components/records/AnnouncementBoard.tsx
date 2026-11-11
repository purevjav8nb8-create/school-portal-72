'use client';

import { FormEvent, useEffect, useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../../lib/backendApi';
import { supabase } from '../../../../lib/supabaseClient';
import AnnouncementAttachments, { AnnouncementAttachment } from './AnnouncementAttachments';
import FloatingComposer from './FloatingComposer';
import UnitTargetSelector from './UnitTargetSelector';
import AnnouncementFeed, { Announcement } from './AnnouncementFeed';

const apiUrl = backendBaseUrl;

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
  const [infoType, setInfoType] = useState<'Амжилт' | 'Оролцоо' | 'Олимпиад' | 'Уралдаан, тэмцээн'>('Олимпиад');
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
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Зар уншигдсангүй.');
    }

  };

  useEffect(() => { void loadAnnouncements(); }, []);

  const publish = async (event: FormEvent<HTMLFormElement>, close: () => void) => {
    event.preventDefault();
    if (boardType === 'Зар' && targetUnits.length === 0) {
      setMessage('“Бүгд” эсвэл дор хаяж нэг нэгж сонгоно уу.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const result = await request('POST', { title, body, attachments, target_units: boardType === 'Мэдээлэл' ? [] : targetUnits, kind: boardType, info_type: boardType === 'Мэдээлэл' ? infoType : null });
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
          {boardType === 'Мэдээлэл' && <select value={infoType} onChange={(event) => setInfoType(event.target.value as 'Амжилт' | 'Оролцоо' | 'Олимпиад' | 'Уралдаан, тэмцээн')} style={fieldStyle}><option>Олимпиад</option><option>Уралдаан, тэмцээн</option><option>Амжилт</option></select>}
          <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Гарчиг
            <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={`${boardType}-ийн гарчиг`} style={fieldStyle} />
          </label>
          <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Агуулга
            <textarea required rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder={`${boardType}-ийн агуулга`} style={fieldStyle} />
          </label>
          <AnnouncementAttachments attachments={attachments} onChange={setAttachments} />
          {boardType === 'Мэдээлэл' ? (
            <small style={{ color: '#64748b' }}>Амжилт, олимпиад, уралдаан тэмцээний мэдээлэл бүх багшид харагдана.</small>
          ) : (
            <>
              <UnitTargetSelector selectedUnits={targetUnits} setSelectedUnits={setTargetUnits} label="Хэнд харагдах" />
              <small style={{ color: '#64748b' }}>“Бүгд” сонговол бүх нэгжийн багшид харагдана.</small>
            </>
          )}
          <button type="submit" disabled={busy} style={{ padding: '11px 14px', border: 0, borderRadius: 8, background: busy ? '#cbd5e1' : '#0f766e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Нийтэлж байна...' : `${boardType} нийтлэх`}</button>
          </form>
        )}
      </FloatingComposer>
      {message && <p role="status">{message}</p>}
      <AnnouncementFeed announcements={announcements} />
    </section>
  );
}
