'use client';

import { useState } from 'react';
import { backendBaseUrl } from '../../../lib/backendApi';
import { supabase } from '../../../lib/supabaseClient';
import { Teacher } from '../types';
import { subjectsForUnit } from './records/ClassFields';

interface Props {
  teacher: Teacher | null;
  selectedMonth: string;
  onClose: () => void;
  onTeacherUpdated: (teacher: Teacher) => void;
}

export default function TeacherDetailModal({ teacher, selectedMonth, onClose, onTeacherUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => teacher ? {
    first_name: teacher.first_name,
    last_name: teacher.last_name,
    unit: teacher.unit,
    subject: teacher.subject,
  } : null);
  if (!teacher) return null;
  const records = (teacher.daily_records ?? []).filter((record) =>
    typeof record.date === 'string' && record.date.startsWith(selectedMonth),
  );
  const present = records.filter((record) => record.status === 'Ирсэн').length;
  const rate = records.length ? Math.round((present / records.length) * 100) : 0;
  const weeklyHours = teacher.weekly_teaching_hours ?? (teacher.teaching_classes ?? []).reduce((sum, item) => sum + item.weekly_hours, 0);

  return (
    <div role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, .5)' }}>
      <section role="dialog" aria-modal="true" aria-label="Багшийн дэлгэрэнгүй" style={{ width: 'min(720px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: 24, borderRadius: 14, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
          <div>
            <h2 style={{ margin: 0 }}>{teacher.last_name} {teacher.first_name}</h2>
            <p style={{ margin: '6px 0', color: '#475569' }}>{teacher.email} · {teacher.unit} · {teacher.subject}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Цонх хаах" style={{ border: 0, background: '#e2e8f0', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>Хаах</button>
        </header>
        {!editing ? (
          <button type="button" onClick={() => { setForm({ first_name: teacher.first_name, last_name: teacher.last_name, unit: teacher.unit, subject: teacher.subject }); setEditing(true); }} style={{ marginTop: 14, padding: '9px 12px', border: 0, borderRadius: 8, background: '#fb923c', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Мэдээлэл засах
          </button>
        ) : (
          <form onSubmit={async (event) => {
            event.preventDefault();
            if (!form || !teacher.auth_id) return;
            setSaving(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error('Нэвтрэх эрх дууссан байна.');
              const response = await fetch(`${backendBaseUrl}/api/teachers/${teacher.auth_id}`, {
                method: 'PATCH',
                headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.detail ?? 'Мэдээлэл шинэчлэгдсэнгүй.');
              onTeacherUpdated({ ...teacher, ...result.teacher });
              setEditing(false);
            } catch (error) {
              alert(error instanceof Error ? error.message : 'Мэдээлэл шинэчлэгдсэнгүй.');
            } finally {
              setSaving(false);
            }
          }} style={{ display: 'grid', gap: 8, marginTop: 14, padding: 14, borderRadius: 10, background: '#f8fafc' }}>
            <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Овог
              <input required value={form?.last_name ?? ''} placeholder="Овог" onChange={(event) => setForm((current) => current && { ...current, last_name: event.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Нэр
              <input required value={form?.first_name ?? ''} placeholder="Нэр" onChange={(event) => setForm((current) => current && { ...current, first_name: event.target.value })} />
            </label>
            <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Нэгж
              <select value={form?.unit ?? teacher.unit} onChange={(event) => setForm((current) => current && { ...current, unit: event.target.value as Teacher['unit'], subject: '' })}>
                <option value="БАЗАН">БАЗАН</option><option value="БУЗАН">БУЗАН</option><option value="НУЗАН">НУЗАН</option>
              </select>
            </label>
            <label style={{ display: 'grid', gap: 4, fontWeight: 600 }}>Заах хичээл
              <select required value={form?.subject ?? ''} onChange={(event) => setForm((current) => current && { ...current, subject: event.target.value })}>
                <option value="" disabled>Заах хичээл сонгох</option>
                {subjectsForUnit(form?.unit ?? teacher.unit).map((subject) => <option key={subject}>{subject}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving} style={{ padding: '8px 12px', border: 0, borderRadius: 8, background: '#16a34a', color: '#fff', fontWeight: 700 }}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</button>
              <button type="button" onClick={() => setEditing(false)} style={{ padding: '8px 12px', border: 0, borderRadius: 8, background: '#64748b', color: '#fff' }}>Буцах</button>
            </div>
          </form>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '18px 0' }}>
          <Stat label="Сарын ирц" value={`${rate}%`} />
          <Stat label="Бүртгэлтэй өдөр" value={String(records.length)} />
          <Stat label="7 хоногийн цаг" value={String(weeklyHours)} />
          <Stat label="Илүү цаг" value={String(teacher.overtime_hours ?? Math.max(0, weeklyHours - 19))} />
        </div>
        <h3>Заадаг ангиуд</h3>
        {(teacher.teaching_classes ?? []).length === 0 ? <p>Анги бүртгэгдээгүй байна.</p> : (
          <ul>{teacher.teaching_classes?.map((item) => <li key={`${item.grade}-${item.section}`}>{item.grade}-р анги {item.section} · 7 хоногт {item.weekly_hours} цаг</li>)}</ul>
        )}
        <h3>Энэ сарын ирц ({selectedMonth})</h3>
        {records.length === 0 ? <p>Ирцийн бүртгэл алга.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={cell}>Огноо</th><th style={cell}>Төлөв</th></tr></thead>
            <tbody>{records.sort((a, b) => a.date.localeCompare(b.date)).map((record) => <tr key={record.date}><td style={cell}>{record.date}</td><td style={cell}>{record.status}</td></tr>)}</tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div style={{ padding: 10, borderRadius: 8, background: '#f1f5f9' }}><div style={{ fontSize: 12, color: '#64748b' }}>{label}</div><b>{value}</b></div>;
}

const cell = { padding: 8, textAlign: 'left' as const, borderBottom: '1px solid #e2e8f0' };
