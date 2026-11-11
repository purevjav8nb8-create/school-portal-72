'use client';

import { useState } from 'react';
import { backendBaseUrl, fetchWithAuth } from '../../../lib/backendApi';
import { Teacher } from '../types';
import FloatingComposer from './records/FloatingComposer';
import { gradesForUnit, romanGrade } from './records/ClassFields';
import { supabase } from '../../../lib/supabaseClient';
import TeachingClassDialog from './TeachingClassDialog';
import TeachingClassSummary from './TeachingClassSummary';

type TeachingClass = NonNullable<Teacher['teaching_classes']>[number];
const apiUrl = backendBaseUrl;
const fieldStyle = { display: 'block', width: '100%', marginTop: 4, padding: 9, border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' as const };

interface Props {
  unit: string;
  initialClasses: TeachingClass[];
}

export default function TeachingClassesPanel({ unit, initialClasses }: Props) {
  const [classes, setClasses] = useState<TeachingClass[]>(initialClasses);
  const grades = gradesForUnit(unit);
  const [draft, setDraft] = useState<TeachingClass>({ grade: grades[0], section: 'А', weekly_hours: 1, homeroom: false });
  const [selectedClass, setSelectedClass] = useState<TeachingClass | null>(null);
  const [dialog, setDialog] = useState<'actions' | 'edit' | 'delete' | null>(null);
  const [message, setMessage] = useState('');

  const persistClasses = async (nextClasses: TeachingClass[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const mockToken = window.localStorage.getItem('school-portal-mock-token');
    const token = mockToken ?? session?.access_token;
    if (!token) throw new Error('Нэвтрэх эрх дууссан байна.');
    const response = await fetchWithAuth(`${apiUrl}/api/teachers/me/teaching-classes`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ classes: nextClasses }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail ?? 'Анги хадгалагдсангүй.');
  };

  const addClass = async (close: () => void) => {
    const nextClasses = [...classes.filter((item) => !(item.grade === draft.grade && item.section === draft.section)), draft];
    try {
      await persistClasses(nextClasses);
      setClasses(nextClasses);
      setMessage('');
      close();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Анги хадгалагдсангүй.');
    }
  };

  const openClassActions = (item: TeachingClass) => {
    setSelectedClass(item);
    setDialog('actions');
  };

  const saveEdit = async () => {
    if (!selectedClass) return;
    const nextClasses = classes.map((item) => item === selectedClass ? draft : item);
    try {
      await persistClasses(nextClasses);
      setClasses(nextClasses);
      setSelectedClass(draft);
      setDialog(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Анги хадгалагдсангүй.');
    }
  };

  const confirmDelete = async () => {
    if (!selectedClass) return;
    const nextClasses = classes.filter((item) => item !== selectedClass);
    try {
      await persistClasses(nextClasses);
      setClasses(nextClasses);
      setSelectedClass(null);
      setDialog(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Анги устгагдсангүй.');
    }
  };

  const removeClass = async (item: TeachingClass) => {
    const nextClasses = classes.filter((current) => current !== item);
    try {
      await persistClasses(nextClasses);
      setClasses(nextClasses);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Анги устгагдсангүй.');
    }
  };

  const setHomeroom = async (item: TeachingClass, homeroom: boolean) => {
    const nextClasses = classes.map((current) =>
      current.grade === item.grade && current.section === item.section ? { ...current, homeroom } : current,
    );
    try {
      await persistClasses(nextClasses);
      setClasses(nextClasses);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Анги удирдсан төлөв хадгалагдсангүй.');
    }
  };

  return (
    <section style={{ marginTop: 10, marginBottom: 10, padding: 8, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <FloatingComposer title="Заадаг ангиуд" label="Заадаг ангиуд" trigger={<button type="button" style={{ width: '100%', padding: '7px 8px', border: 0, borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Заадаг ангиуд ({classes.length})</button>}>
          {(close) => (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ color: '#172554' }}>Одоогийн жагсаалт</strong>
                {classes.length === 0 ? <p style={{ margin: 0, color: '#64748b' }}>Анги бүртгэгдээгүй байна.</p> : classes.map((item) => (
                  <div key={`${item.grade}-${item.section}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '7px 9px', border: '1px solid #e2e8f0', borderRadius: 7, background: '#f8fafc' }}>
                    <span>{item.grade}-р анги {item.section} · {item.weekly_hours} цаг</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={Boolean(item.homeroom)} onChange={(event) => void setHomeroom(item, event.target.checked)} />
                      АУБ
                    </label>
                    <button type="button" onClick={() => void removeClass(item)} aria-label={`${item.grade}-р анги ${item.section} устгах`} title="Анги устгах" style={{ padding: '3px 7px', border: 0, borderRadius: 5, background: '#fee2e2', color: '#b91c1c', cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
              <hr style={{ width: '100%', border: 0, borderTop: '1px solid #e2e8f0' }} />
              <strong style={{ color: '#172554' }}>Шинэ анги нэмэх</strong>
              <label>Анги<select value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: Number(event.target.value) })} style={fieldStyle}>{grades.map((grade) => <option key={grade} value={grade}>{romanGrade(grade)} анги</option>)}</select></label>
              <label>Бүлэг<select value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })} style={fieldStyle}>{['А', 'Б', 'В', 'Г', 'Д', 'Е'].map((section) => <option key={section}>{section}</option>)}</select></label>
              <label>7 хоногийн цаг<input type="number" min={1} value={draft.weekly_hours} onChange={(event) => setDraft({ ...draft, weekly_hours: Math.max(1, Number(event.target.value)) })} style={fieldStyle} /></label>
              <button type="button" onClick={() => addClass(close)} style={{ padding: 10, border: 0, borderRadius: 6, background: '#16a34a', color: '#fff' }}>Хадгалах</button>
            </div>
          )}
        </FloatingComposer>
      </div>
      <TeachingClassSummary classes={classes} />
      {message && <small role="alert" style={{ display: 'block', marginTop: 6, color: '#b91c1c' }}>{message}</small>}
      {dialog && selectedClass && <TeachingClassDialog unit={unit} selectedClass={selectedClass} dialog={dialog} draft={draft} onDraftChange={setDraft} onDialogChange={setDialog} onSave={saveEdit} onDelete={confirmDelete} />}
    </section>
  );
}
