'use client';

import { useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { Teacher } from '../types';
import { gradesForUnit, romanGrade } from './records/ClassFields';
import { supabase } from '../../../lib/supabaseClient';

type TeachingClass = NonNullable<Teacher['teaching_classes']>[number];
const fieldStyle = { display: 'block', width: '100%', marginTop: 4, padding: 9, border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' as const };

interface Props {
  unit: string;
  initialClasses: TeachingClass[];
}

export default function TeachingClassesPanel({ unit, initialClasses }: Props) {
  const [classes, setClasses] = useState<TeachingClass[]>(initialClasses.filter((item) => item.homeroom));
  const grades = gradesForUnit(unit);
  const [grade, setGrade] = useState(grades[0]);
  const [section, setSection] = useState('А');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const persistClasses = async (nextClasses: TeachingClass[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const mockToken = window.localStorage.getItem('school-portal-mock-token');
    const token = mockToken ?? session?.access_token;
    if (!token) throw new Error('Нэвтрэх эрх дууссан байна.');
    const response = await fetchWithAuth(`${backendBaseUrl}/api/teachers/me/homeroom-classes`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ classes: nextClasses.map(({ grade: classGrade, section: classSection }) => ({ grade: classGrade, section: classSection })) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Даасан анги хадгалагдсангүй.');
  };

  const saveClasses = async (nextClasses: TeachingClass[]) => {
    setSaving(true);
    try {
      await persistClasses(nextClasses);
      setClasses(nextClasses);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Даасан анги хадгалагдсангүй.');
    } finally {
      setSaving(false);
    }
  };

  const addClass = () => {
    if (classes.some((item) => item.grade === grade && item.section === section)) {
      setMessage('Энэ анги жагсаалтад байна.');
      return;
    }
    void saveClasses([...classes, { grade, section, weekly_hours: 0, homeroom: true }]);
  };

  return (
    <section style={{ display: 'grid', gap: 7, margin: '10px 0', padding: 8, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12 }}>
      <strong>Даасан анги</strong>
      {classes.map((item) => (
        <div key={`${item.grade}-${item.section}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc' }}>
          <span>{romanGrade(item.grade)} анги {item.section}</span>
          <button type="button" disabled={saving} onClick={() => void saveClasses(classes.filter((current) => current !== item))} aria-label={`${item.grade}-р анги ${item.section} даасан ангиас хасах`} style={{ padding: '2px 6px', border: 0, borderRadius: 5, background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' }}>×</button>
        </div>
      ))}
      <label>Анги<select value={grade} onChange={(event) => setGrade(Number(event.target.value))} style={fieldStyle}>{grades.map((item) => <option key={item} value={item}>{romanGrade(item)} анги</option>)}</select></label>
      <label>Бүлэг<select value={section} onChange={(event) => setSection(event.target.value)} style={fieldStyle}>{['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З'].map((item) => <option key={item}>{item}</option>)}</select></label>
      <button type="button" disabled={saving || classes.length >= 5} onClick={addClass} style={{ padding: 8, border: 0, borderRadius: 6, background: saving ? '#94a3b8' : '#2563eb', color: '#fff', cursor: saving ? 'wait' : 'pointer', fontWeight: 700 }}>Даасан анги нэмэх</button>
      {message && <small role="alert" style={{ color: '#b91c1c' }}>{message}</small>}
    </section>
  );
}
