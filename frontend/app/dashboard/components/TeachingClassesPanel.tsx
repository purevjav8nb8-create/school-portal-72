'use client';

import { useState } from 'react';
import { Teacher } from '../types';
import FloatingComposer from './records/FloatingComposer';
import { gradesForUnit, romanGrade } from './records/ClassFields';
import { supabase } from '../../../lib/supabaseClient';

type TeachingClass = NonNullable<Teacher['teaching_classes']>[number];
const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://127.0.0.1:8000';

interface Props {
  unit: string;
  initialClasses: TeachingClass[];
}

export default function TeachingClassesPanel({ unit, initialClasses }: Props) {
  const [classes, setClasses] = useState<TeachingClass[]>(initialClasses);
  const grades = gradesForUnit(unit);
  const [draft, setDraft] = useState<TeachingClass>({ grade: grades[0], section: 'А', weekly_hours: 1 });
  const [selectedClass, setSelectedClass] = useState<TeachingClass | null>(null);
  const [dialog, setDialog] = useState<'actions' | 'edit' | 'delete' | null>(null);
  const [message, setMessage] = useState('');

  const persistClasses = async (nextClasses: TeachingClass[]) => {
    const { data: { session } } = await supabase.auth.getSession();
    const mockToken = window.localStorage.getItem('school-portal-mock-token');
    const token = mockToken ?? session?.access_token;
    if (!token) throw new Error('Нэвтрэх эрх дууссан байна.');
    const response = await fetch(`${apiUrl}/api/teachers/me/teaching-classes`, {
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

  return (
    <section style={{ marginTop: 10, marginBottom: 10, padding: 8, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14 }}>Заадаг ангиуд</h3>
        <FloatingComposer title="Заадаг анги нэмэх" label="Заадаг анги нэмэх" trigger={<button type="button" aria-label="Анги нэмэх" title="Анги нэмэх" style={{ width: 28, height: 28, padding: 0, border: 0, borderRadius: 5, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>+</button>}>
          {(close) => (
            <div style={{ display: 'grid', gap: 10 }}>
              <label>Анги<select value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: Number(event.target.value) })} style={fieldStyle}>{grades.map((grade) => <option key={grade} value={grade}>{romanGrade(grade)} анги</option>)}</select></label>
              <label>Бүлэг<select value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })} style={fieldStyle}>{['А', 'Б', 'В', 'Г', 'Д', 'Е'].map((section) => <option key={section}>{section}</option>)}</select></label>
              <label>7 хоногийн цаг<input type="number" min={1} value={draft.weekly_hours} onChange={(event) => setDraft({ ...draft, weekly_hours: Math.max(1, Number(event.target.value)) })} style={fieldStyle} /></label>
              <button type="button" onClick={() => addClass(close)} style={{ padding: 10, border: 0, borderRadius: 6, background: '#16a34a', color: '#fff' }}>Хадгалах</button>
            </div>
          )}
        </FloatingComposer>
      </div>
      {classes.length === 0 ? <p style={{ color: '#64748b' }}>Анги бүртгэгдээгүй байна.</p> : (
        <ul style={{ margin: '6px 0', paddingLeft: 18 }}>{classes.map((item) => (
          <li key={`${item.grade}-${item.section}`} style={{ margin: '4px 0' }}>
            <button
              type="button"
              onClick={() => openClassActions(item)}
              style={{ padding: 0, border: 0, background: 'transparent', color: '#2563eb', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}
            >
              {item.grade}-р анги {item.section} · {item.weekly_hours} цаг
            </button>
          </li>
        ))}</ul>
      )}
      <div style={{ display: 'grid', gap: 2, marginTop: 6, fontSize: 12, lineHeight: 1.2 }}>
        <b>Нийт: {classes.reduce((sum, item) => sum + item.weekly_hours, 0)} цаг</b>
        <b>Илүү цаг: {Math.max(0, classes.reduce((sum, item) => sum + item.weekly_hours, 0) - 19)} цаг</b>
      </div>
      {message && <small role="alert" style={{ display: 'block', marginTop: 6, color: '#b91c1c' }}>{message}</small>}
      {dialog && selectedClass && (
        <div
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setDialog(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15, 23, 42, .45)' }}
        >
          <section role="dialog" aria-modal="true" style={{ width: 'min(360px, 100%)', padding: 18, borderRadius: 10, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
            {dialog === 'actions' && (
              <>
                <h3 style={{ margin: '0 0 14px', fontSize: 16 }}>{selectedClass.grade}-р анги {selectedClass.section}</h3>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setDraft(selectedClass); setDialog('edit'); }} style={dialogButton('#2563eb')}>Засах</button>
                  <button type="button" onClick={() => setDialog('delete')} style={dialogButton('#dc2626')}>Устгах</button>
                  <button type="button" onClick={() => setDialog(null)} style={dialogButton('#64748b')}>Буцах</button>
                </div>
              </>
            )}
            {dialog === 'edit' && (
              <>
                <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Анги засах</h3>
                <label>Анги<select value={draft.grade} onChange={(event) => setDraft({ ...draft, grade: Number(event.target.value) })} style={fieldStyle}>{grades.map((grade) => <option key={grade} value={grade}>{romanGrade(grade)} анги</option>)}</select></label>
                <label>Бүлэг<select value={draft.section} onChange={(event) => setDraft({ ...draft, section: event.target.value })} style={fieldStyle}>{['А', 'Б', 'В', 'Г', 'Д', 'Е'].map((section) => <option key={section}>{section}</option>)}</select></label>
                <label>7 хоногийн цаг<input type="number" min={1} value={draft.weekly_hours} onChange={(event) => setDraft({ ...draft, weekly_hours: Math.max(1, Number(event.target.value)) })} style={fieldStyle} /></label>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button type="button" onClick={saveEdit} style={dialogButton('#16a34a')}>Хадгалах</button>
                  <button type="button" onClick={() => setDialog('actions')} style={dialogButton('#64748b')}>Буцах</button>
                </div>
              </>
            )}
            {dialog === 'delete' && (
              <>
                <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Анги устгах уу?</h3>
                <p style={{ margin: '0 0 16px', color: '#475569' }}>{selectedClass.grade}-р анги {selectedClass.section} ангийг устгах гэж байна.</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={confirmDelete} style={dialogButton('#dc2626')}>Устгах</button>
                  <button type="button" onClick={() => setDialog('actions')} style={dialogButton('#64748b')}>Буцах</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

const fieldStyle = { display: 'block', width: '100%', marginTop: 4, padding: 9, border: '1px solid #cbd5e1', borderRadius: 6, boxSizing: 'border-box' as const };
const dialogButton = (background: string) => ({ padding: '7px 10px', border: 0, borderRadius: 6, background, color: '#fff', cursor: 'pointer', fontSize: 12 });
